// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Modo colaborador da app Picagens (telemóvel pessoal, vertical), protótipo v6 aprovado (doc 49): abertura com o
// logótipo, entrada (código da empresa + NIF + PIN, ou link do email), separadores Hoje / Registos / Pedidos /
// Documentos e Perfil pelo avatar. Sessão de 180 dias renovada a cada abertura; 401 → sai.
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, ChartIcon, ClockIcon, DocumentIcon } from '../components/icons';
import { QUEUE_RETRY_MS } from '../config';
import { ApiError } from '../http';
import { UpdateRequiredScreen } from '../kiosk/screens/InfoScreens';
import { colors, fonts } from '../theme';
import { DEFAULT_UPDATE_URL, isNewer } from '../update';
import { Dashboard, Me, Notice, Session, employeeApi } from './api';
import { clearEmployeeQueue, flushEmployeeQueue, pendingEmployeePunches } from './queue';
import { DocumentsScreen } from './screens/DocumentsScreen';
import { LocationIntroScreen } from './screens/LocationIntroScreen';
import { LoginScreen, Splash, parseActivationLink } from './screens/LoginScreen';
import { PhotosScreen } from './screens/PhotosScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { clearSession, getCachedMe, getEmployeeToken, saveSession } from './storage';
import { FadeIn, useToast } from './ui';

type Tab = 'today' | 'records' | 'requests' | 'documents';

const TABS: { key: Tab; label: string; Icon: typeof ClockIcon }[] = [
  { key: 'today', label: 'Hoje', Icon: ClockIcon },
  { key: 'records', label: 'Registos', Icon: ChartIcon },
  { key: 'requests', label: 'Pedidos', Icon: CalendarIcon },
  { key: 'documents', label: 'Documentos', Icon: DocumentIcon },
];

const SPLASH_MS = 1300;

const sessionToMe = ({ token: _token, validade_dias: _days, ...me }: Session & { ok?: boolean }): Me => me;

export function EmployeeApp({ onKiosk }: { onKiosk: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [splash, setSplash] = useState(true);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [profile, setProfile] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [contract, setContract] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [locationIntro, setLocationIntro] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  const logout = useCallback(async () => {
    clearEmployeeQueue();
    await clearSession();
    setMe(null);
    setDashboard(null);
    setTab('today');
    setProfile(false);
    setPhotos(false);
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
    const profileData = sessionToMe(session);
    await saveSession(session.token, profileData);
    setMe(profileData);
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

  // "Voltar" do Android: Perfil e contrato voltam atrás; outros separadores voltam a Hoje; em Hoje sai da app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (photos) { setPhotos(false); return true; }
      if (profile) { setProfile(false); return true; }
      if (contract) { setContract(null); return true; }
      if (tab === 'today') return false;
      setTab('today');
      return true;
    });
    return () => subscription.remove();
  }, [tab, profile, photos, contract]);

  const openNotice = useCallback((notice: Notice) => {
    setProfile(false);
    setPhotos(false);
    if (notice.acao === 'contrato' && notice.id) {
      setContract(notice.id);
      setTab('documents');
    } else {
      setTab('records');
    }
  }, []);

  if (splash) return <><StatusBar style="dark" /><Splash /></>;

  if (updateRequired) return <View style={{ flex: 1, backgroundColor: colors.bg }}><UpdateRequiredScreen url={me?.url_atualizacao} /></View>;

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
        <LocationIntroScreen
          company={me.empresa.nome}
          onDone={(granted) => {
            setLocationIntro(false);
            toast.show({ tone: 'ok', title: 'Tudo pronto', text: granted ? 'Sessão guardada. A app abre logo em Hoje.' : 'Pode ligar a localização mais tarde em Hoje.' });
          }}
        />
      </>
    );
  }

  const notices = dashboard?.avisos ?? [];
  const updateAvailable = isNewer(me.versao_atual);
  const screenKey = photos ? 'photos' : profile ? 'profile' : tab;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {toast.node}
      <View style={{ flex: 1 }}>
        <FadeIn deps={screenKey}>
          {profile && photos ? (
            <PhotosScreen token={token} company={me.empresa.nome} onBack={() => setPhotos(false)} onAuthError={onAuthError} />
          ) : null}
          {profile && !photos ? (
            <ProfileScreen
              me={me}
              notices={notices}
              pending={pending}
              onBack={() => setProfile(false)}
              onNotice={openNotice}
              onLogout={logout}
              onInfo={(title, text) => toast.show({ tone: 'ok', title, text })}
              onPhotos={() => setPhotos(true)}
            />
          ) : null}
          {!profile && tab === 'today' ? (
            <TodayScreen
              token={token}
              me={me}
              dashboard={dashboard}
              online={online}
              pending={pending}
              notices={dashboard?.avisos_total ?? 0}
              onRefresh={refreshDashboard}
              onProfile={() => setProfile(true)}
              onQueued={() => setPending(pendingEmployeePunches())}
              onAuthError={onAuthError}
              toast={toast.show}
            />
          ) : null}
          {!profile && tab === 'records' ? <RecordsScreen token={token} onAuthError={onAuthError} /> : null}
          {!profile && tab === 'requests' ? <RequestsScreen token={token} onAuthError={onAuthError} /> : null}
          {!profile && tab === 'documents' ? (
            <DocumentsScreen token={token} me={me} openContract={contract} onContractClosed={() => { setContract(null); refreshDashboard(); }} onAuthError={onAuthError} />
          ) : null}
        </FadeIn>
      </View>

      {updateAvailable ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL(me.url_atualizacao || DEFAULT_UPDATE_URL)}
          style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + (profile ? 14 : 86), zIndex: 4, elevation: 7, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.actionSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.action }}>Nova versão disponível · {me.versao_atual}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.action }}>Toque para descarregar e instalar por cima. A sessão mantém-se.</Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.action }}>Atualizar ›</Text>
        </Pressable>
      ) : null}
      {!profile ? (
        <View
          style={{
            position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 14, flexDirection: 'row',
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 6,
            shadowColor: '#101828', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
          }}
        >
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                onPress={() => { setTab(key); setContract(null); }}
                style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, paddingVertical: 7, borderRadius: 16, backgroundColor: active ? colors.actionSoft : 'transparent', transform: [{ scale: pressed ? 0.96 : 1 }] })}
              >
                <Icon size={22} color={active ? colors.action : colors.ink3} />
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: active ? colors.action : colors.ink3 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
