// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Notificações da app (2.3.0, doc 49 §14): pede autorização depois de entrar, regista o token Expo no servidor
// (/notificacoes/registar) e diz que ecrã abrir quando se toca numa notificação (data.ecra enviado pelo servidor:
// hoje, registos, pedidos, documentos, mensagens). No Android o Expo usa o FCM: sem o projeto Firebase ligado ao
// EAS, getExpoPushTokenAsync falha e a app continua a funcionar sem notificações.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { employeeApi } from './api';

export type PushScreen = 'hoje' | 'registos' | 'pedidos' | 'documentos' | 'mensagens';

const PUSH_TOKEN_KEY = 'push_token_expo';
const SCREENS: PushScreen[] = ['hoje', 'registos', 'pedidos', 'documentos', 'mensagens'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Pede autorização (uma vez), obtém o token e regista-o no servidor. Devolve false se não houver notificações. */
export async function registerForPush(sessionToken: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avisos da Picagens',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await employeeApi.registerPush(sessionToken, pushToken, Platform.OS === 'ios' ? 'ios' : 'android');
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
    return true;
  } catch {
    return false;
  }
}

/** Ao terminar sessão: o servidor deixa de enviar avisos desta pessoa para este telemóvel. */
export async function unregisterPush(sessionToken: string) {
  try {
    const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (pushToken) await employeeApi.unregisterPush(sessionToken, pushToken);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // sem rede: o servidor apaga o token quando o Expo disser que já não existe
  }
}

function screenOf(response: Notifications.NotificationResponse | null): PushScreen | null {
  const screen = response?.notification.request.content.data?.ecra;
  return typeof screen === 'string' && (SCREENS as string[]).includes(screen) ? (screen as PushScreen) : null;
}

/** Chama `open` com o ecrã da notificação tocada (também a que abriu a app fechada). Devolve a função de limpeza. */
export function onPushOpened(open: (screen: PushScreen) => void): () => void {
  Notifications.getLastNotificationResponseAsync().then((response) => {
    const screen = screenOf(response);
    if (screen) open(screen);
  });
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = screenOf(response);
    if (screen) open(screen);
  });
  return () => subscription.remove();
}

/** Notificação recebida com a app aberta: para atualizar o contador de mensagens/avisos. */
export function onPushReceived(refresh: () => void): () => void {
  const subscription = Notifications.addNotificationReceivedListener(() => refresh());
  return () => subscription.remove();
}
