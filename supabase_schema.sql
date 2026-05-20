-- Supabase Schema for Safisa Pro Migration
-- Run this in your Supabase SQL Editor

-- 1. Create tables with a generic JSONB column to map directly from Firebase documents
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at BIGINT);
CREATE TABLE IF NOT EXISTS assembledunits (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS kits (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS kitdata (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS servomodeldata (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS kitimages (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS auditlogs (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb, timestamp BIGINT);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb, timestamp BIGINT);
CREATE TABLE IF NOT EXISTS config (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb);

-- 2. Turn on Realtime for all tables
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table assembledunits;
alter publication supabase_realtime add table kits;
alter publication supabase_realtime add table kitdata;
alter publication supabase_realtime add table servomodeldata;
alter publication supabase_realtime add table customers;
alter publication supabase_realtime add table kitimages;
alter publication supabase_realtime add table auditlogs;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table config;

-- 2.5 Storage bucket for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kit-images', 'kit-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2.6 Audit Log Triggers
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    entity_name text;
    action_type text;
    usr text;
    usr_name text;
BEGIN
    entity_name := TG_TABLE_NAME;
    action_type := TG_OP;
    
    IF (TG_OP = 'DELETE') THEN
        usr := COALESCE(OLD.data->>'updatedBy', 'Sistema');
        usr_name := COALESCE(OLD.data->>'updatedByName', 'Sistema');
    ELSE
        usr := COALESCE(NEW.data->>'updatedBy', 'Sistema');
        usr_name := COALESCE(NEW.data->>'updatedByName', 'Sistema');
    END IF;

    INSERT INTO auditlogs (id, data, timestamp) 
    VALUES (
        gen_random_uuid()::text,
        jsonb_build_object(
            'id', gen_random_uuid()::text,
            'action', action_type || ' ' || upper(entity_name),
            'entityType', entity_name,
            'entityId', COALESCE(NEW.id, OLD.id),
            'details', 'Log gerado via trigger (' || action_type || ').',
            'timestamp', extract(epoch from now()) * 1000,
            'user', usr,
            'userName', usr_name
        ),
        (extract(epoch from now()) * 1000)::bigint
    );
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_orders_trigger ON orders;
CREATE TRIGGER audit_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE PROCEDURE process_audit_log();

DROP TRIGGER IF EXISTS audit_assembledunits_trigger ON assembledunits;
CREATE TRIGGER audit_assembledunits_trigger AFTER INSERT OR UPDATE OR DELETE ON assembledunits FOR EACH ROW EXECUTE PROCEDURE process_audit_log();

DROP TRIGGER IF EXISTS audit_kits_trigger ON kits;
CREATE TRIGGER audit_kits_trigger AFTER INSERT OR UPDATE OR DELETE ON kits FOR EACH ROW EXECUTE PROCEDURE process_audit_log();

-- 3. Initial Config Data
INSERT INTO config (id, data) VALUES ('global', '{"passwords": {"ADMIN": "123", "ASSEMBLY": "123", "EXPEDITION": "123", "SYSTEM_SETTINGS": "123"}, "currentSequence": 61000}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- 4. RPC for Transactional Operations (Process Kit Transaction)
CREATE OR REPLACE FUNCTION process_kit_transaction(
    p_order_id TEXT,
    p_new_items_json JSONB,
    p_new_status VARCHAR,
    p_adjustments JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_adj JSONB;
    v_code TEXT;
    v_model TEXT;
    v_quantity INTEGER;
    v_existing_id TEXT;
    v_existing_qty INTEGER;
    v_remaining_deduction INTEGER;
BEGIN
    -- Update order
    UPDATE orders
    SET data = jsonb_set(
        jsonb_set(data, '{items}', p_new_items_json),
        '{status}', to_jsonb(p_new_status)
    )
    WHERE id = p_order_id;

    -- Process kits deductions/additions sequentially
    FOR v_adj IN SELECT * FROM jsonb_array_elements(p_adjustments)
    LOOP
        v_code := v_adj->>'code';
        v_model := v_adj->>'model';
        v_quantity := (v_adj->>'quantity')::INTEGER;

        IF v_quantity > 0 THEN
            -- Add to stock
            INSERT INTO kits (id, data)
            VALUES (
                gen_random_uuid(),
                jsonb_build_object(
                    'name', v_code,
                    'quantity', v_quantity,
                    'model', v_model
                )
            );
        ELSIF v_quantity < 0 THEN
            -- Deduct from stock
            v_remaining_deduction := -v_quantity;
            
            WHILE v_remaining_deduction > 0 LOOP
                -- Find an existing kit
                SELECT id, (data->>'quantity')::INTEGER INTO v_existing_id, v_existing_qty
                FROM kits
                WHERE (upper(data->>'name') = upper(v_code) OR upper(data->>'name') = upper('KIT ' || v_code))
                  AND (data->>'quantity')::INTEGER > 0
                LIMIT 1
                FOR UPDATE;

                IF NOT FOUND THEN
                    -- No more kits to deduct from
                    EXIT;
                END IF;

                IF v_existing_qty >= v_remaining_deduction THEN
                    UPDATE kits
                    SET data = jsonb_set(data, '{quantity}', to_jsonb(v_existing_qty - v_remaining_deduction))
                    WHERE id = v_existing_id;
                    
                    v_remaining_deduction := 0;
                ELSE
                    DELETE FROM kits WHERE id = v_existing_id;
                    v_remaining_deduction := v_remaining_deduction - v_existing_qty;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;

-- 5. RPC for Manual Stock Adjustment
CREATE OR REPLACE FUNCTION manual_kit_adjustment(
    p_code TEXT,
    p_quantity INTEGER,
    p_model TEXT DEFAULT 'Geral',
    p_user_id TEXT DEFAULT 'Sistema',
    p_user_name TEXT DEFAULT 'Sistema',
    p_observation TEXT DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_id UUID;
    v_existing_qty INTEGER;
    v_remaining_deduction INTEGER;
BEGIN
    IF p_quantity > 0 THEN
        -- Add to stock
        INSERT INTO kits (id, data)
        VALUES (
            gen_random_uuid(),
            jsonb_build_object(
                'name', p_code,
                'quantity', p_quantity,
                'model', p_model,
                'updatedBy', p_user_id,
                'updatedByName', p_user_name,
                'observation', p_observation
            )
        );
    ELSIF p_quantity < 0 THEN
        -- Deduct from stock
        v_remaining_deduction := -p_quantity;
        
        WHILE v_remaining_deduction > 0 LOOP
            SELECT id, (data->>'quantity')::INTEGER INTO v_existing_id, v_existing_qty
            FROM kits
            WHERE (upper(data->>'name') = upper(p_code) OR upper(data->>'name') = upper('KIT ' || p_code))
              AND (data->>'quantity')::INTEGER > 0
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                EXIT;
            END IF;

            IF v_existing_qty >= v_remaining_deduction THEN
                UPDATE kits
                SET data = jsonb_set(data, '{quantity}', to_jsonb(v_existing_qty - v_remaining_deduction))
                WHERE id = v_existing_id;
                v_remaining_deduction := 0;
            ELSE
                DELETE FROM kits WHERE id = v_existing_id;
                v_remaining_deduction := v_remaining_deduction - v_existing_qty;
            END IF;
        END LOOP;
    END IF;
END;
$$;
