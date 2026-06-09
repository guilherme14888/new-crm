import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

/** Hook que monitora o status de conexão de rede, verificando a cada 10 segundos se o dispositivo está online */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Network.getNetworkStateAsync().then((state) => {
      if (isMounted) setIsOnline(state.isConnected ?? true);
    });
    const interval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      if (isMounted) setIsOnline(state.isConnected ?? true);
    }, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}
