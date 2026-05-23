import { useEffect, useState } from 'react';
import * as JSPM from 'jsprintmanager';

export function usePrinters() {
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');

  useEffect(() => {
    JSPM.JSPrintManager.auto_reconnect = true;
    JSPM.JSPrintManager.start();

    JSPM.JSPrintManager.WS.onStatusChanged = function () {
      if (JSPM.JSPrintManager.websocket_status === JSPM.WSStatus.Open) {
        JSPM.JSPrintManager.getPrinters().then(function (availablePrinters: string[]) {
          setPrinters(availablePrinters);
          if (availablePrinters.length > 0) {
            setSelectedPrinter(availablePrinters[0]);
          }
        });
      }
    };
  }, []);

  return {
    printers,
    selectedPrinter,
    setSelectedPrinter
  };
}
