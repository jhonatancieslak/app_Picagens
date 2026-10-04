// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Modo colaborador da app Picagens (telemóvel pessoal, vertical): entrar (código da empresa + NIF + PIN, ou link do email),
// Hoje (picar com GPS), Registos e Perfil. Sessão de 180 dias renovada a cada abertura; 401 → sai.
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeIcon, ListIcon, UserIcon } from '../components/icons';
import { QUEUE_RETRY_MS } from '../config';
import { ApiError } from '../http';
import { UpdateRequiredScreen } from '../kiosk/screens/InfoScreens';
import { colors, fonts } from '../theme';
import { Dashboard, Me, Session, employeeApi } from './api';
import { clearEmployeeQueue, flushEmployeeQueue, pendingEmployeePunches } from './queue';
import { LocationIntroScreen } from './screens/LocationIntroScreen';
import { LoginScreen, parseActivationLink } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { clearSession, getCachedMe, getEmployeeToken, saveSession } from './storage';

type Tab = 'today' | 'records' | 'profile';

const TABS: { key: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'today', label: 'Hoje', Icon: HomeIcon },
  { key: 'records', label: 'Registos', Icon: ListIcon },
  { key: 'profile', label: 'Perfil', Icon: UserIcon },
];

const sessionToMe = ({ token: _token, validade_dias: _days, ...me }: Session & { ok?: boolean }): Me => me;

export function EmployeeApp({ onKiosk }: { onKiosk: () => void }) {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [locationIntro, setLocationIntro] = useState(false);

  const logout = useCallback(async () => {
    clearEmployeeQueue();
    await clearSession();
    setMe(null);
    setDashboard(null);
    setTab('today');
    setToken(null);
  }, []);

  /** 401 = sessão revogada no painel; 426 = versão antiga. Devolve true se o erro foi tratado. */
  const onAuthError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      logout();
      return true;
    }
    if (error instanceof ApiError && error.status === 426) {
      setUpdateRequired(true);
      return true;
    }
    return false;
  }, [logout]);

  const startSession = useCallback(async (session: Session) => {
    const profile = sessionToMe(session);
    await saveSession(session.token, profile);
    setMe(profile);
    setToken(session.token);
    // Android ainda não perguntou pela localização: explicar antes (doc 49 §11).
    const permission = await Location.getForegroundPermissionsAsync();
    setLocationIntro(permission.status === Location.PermissionStatus.UNDETERMINED);
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!token) return;
    try {
      setDashboard(await employeeApi.dashboard(token));
    } catch (error) {
      onAuthError(error);
    }
  }, [token, onAuthError]);

  const sendQueue = useCallback(async () => {
    if (!token || !pendingEmployeePunches()) return;
    const result = await flushEmployeeQueue(token);
    setPending(pendingEmployeePunches());
    if (result.sent || result.refused.length) refreshDashboard();
  }, [token, refreshDashboard]);

  // Arranque: sessão guardada; depois renova o token (quem usa a app nunca volta a ter de entrar).
  useEffect(() => {
    (async () => {
      const [savedToken, cachedMe] = await Promise.all([getEmployeeToken(), getCachedMe()]);
      setMe(cachedMe);
      setPending(pendingEmployeePunches());
      setToken(savedToken && cachedMe ? savedToken : null);
      if (savedToken && cachedMe) {
        employeeApi.renew(savedToken).then(startSession).catch(onAuthError);
      }
    })();
  }, [startSession, onAuthError]);

  // Link de ativação aberto a partir do email (com a app fechada ou aberta).
  useEffect(() => {
    Linking.getInitialURL().then((url) => url && parseActivationLink(url) && setLink(url));
    const subscription = Linking.addEventListener('url', ({ url }) => parseActivationLink(url) && setLink(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    refreshDashboard();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refreshDashboard());
    return () => subscription.remove();
  }, [refreshDashboard]);

  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))), []);

  useEffect(() => {
    if (!online || !token) return;
    sendQueue();
    const timer = setInterval(sendQueue, QUEUE_RETRY_MS);
    return () => clearInterval(timer);
  }, [online, token, sendQueue]);

  // "Voltar" do Android: dos outros separadores volta a Hoje; em Hoje sai da app (comportamento normal).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'today') return false;
      setTab('today');
      return true;
    });
    return () => subscription.remove();
  }, [tab]);

  if (updateRequired) return <View style={{ flex: 1, backgroundColor: colors.bg }}><UpdateRequiredScreen /></View>;

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (!token || !me) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen link={link} onSession={startSession} onKiosk={onKiosk} />
      </>
    );
  }

  if (locationIntro) {
    return (
      <>
        <StatusBar style="dark" />
        <LocationIntroScreen company={me.empresa.nome} onDone={() => setLocationIntro(false)} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {tab === 'today' ? (
        <TodayScreen
          token={token}
          me={me}
          dashboard={dashboard}
          online={online}
          pending={pending}
          onRefresh={refreshDashboard}
          onProfile={() => setTab('profile')}
          onQueued={() => setPending(pendingEmployeePunches())}
          onAuthError={onAuthError}
        />
      ) : null}
      {tab === 'records' ? <RecordsScreen token={token} onAuthError={onAuthError} /> : null}
      {tab === 'profile' ? (
        <ProfileScreen me={me} notices={dashboard?.avisos ?? []} pending={pending} onRecords={() => setTab('records')} onLogout={logout} />
      ) : null}

      <View
        style={{
          position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12, flexDirection: 'row',
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 6,
          shadowColor: '#101828', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          const badge = key === 'profile' ? dashboard?.avisos_total ?? 0 : 0;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={badge ? `${label}, ${badge} avisos` : label}
              onPress={() => setTab(key)}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 16, backgroundColor: active ? colors.actionSoft : 'transparent' }}
            >
              <Icon size={22} color={active ? colors.action : colors.ink3} />
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: active ? colors.action : colors.ink3 }}>{label}</Text>
              {badge ? <View style={{ position: 'absolute', top: 6, right: '30%', width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
