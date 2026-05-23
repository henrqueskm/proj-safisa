import { toast } from 'sonner';
import { KitData, ServoModelData, AppUser } from '../types';
import { supabase } from '../supabase';
import { uploadFile } from '../supabaseStorage';
import { cleanData } from './useOrderManagement';

export function useConfigActions() {
  const updateConfig = async (data: any) => {
    const { data: config } = await supabase.from('config').select('data').eq('id', 'global').single();
    const currentData = config?.data || {};
    await supabase.from('config').update({ data: cleanData({ ...currentData, ...data }) }).eq('id', 'global');
  };

  const setSequence = async (value: number) => {
    const { data: config } = await supabase.from('config').select('data').eq('id', 'global').single();
    const currentData = config?.data || {};
    await supabase.from('config').update({ data: { ...currentData, currentSequence: Number(value) } }).eq('id', 'global');
  };

  const saveKitImage = async (id: string, file: File) => {
    const extension = file.name.split('.').pop();
    const url = await uploadFile('kit-images', `${id}-${Date.now()}.${extension}`, file);
    await supabase.from('kitimages').upsert({ id, data: { id, data: url } });
  };

  const deleteKitImage = async (id: string) => {
    await supabase.from('kitimages').delete().eq('id', id);
  };

  const saveKitData = async (kitData: KitData) => {
    await supabase.from('kitdata').upsert({ id: kitData.id, data: cleanData(kitData) });
  };

  const deleteKitData = async (id: string) => {
    await supabase.from('kitdata').delete().eq('id', id);
  };

  const saveServoModelData = async (servoModelData: ServoModelData) => {
    await supabase.from('servomodeldata').upsert({ id: servoModelData.id, data: cleanData(servoModelData) });
  };

  const deleteServoModelData = async (id: string) => {
    await supabase.from('servomodeldata').delete().eq('id', id);
  };

  const saveUser = async (user: AppUser) => {
    const result = await supabase.from('users').upsert({ id: user.id, data: cleanData(user) });
    if (result.error) {
      console.error('Error saving user:', result.error);
      toast.error('Erro ao salvar usuário DB', { description: result.error.message });
      return false;
    }
    return true;
  };

  const deleteUser = async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
  };

  return {
    updateConfig,
    setSequence,
    saveKitImage,
    deleteKitImage,
    saveKitData,
    deleteKitData,
    saveServoModelData,
    deleteServoModelData,
    saveUser,
    deleteUser
  };
}
