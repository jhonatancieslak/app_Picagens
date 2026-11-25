// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Modo colaborador da app Picagens (telemóvel pessoal, vertical), protótipo v6 aprovado (doc 49): abertura com o
// logótipo, entrada (código da empresa + NIF + PIN, ou link do email), separadores Hoje / Registos / Pedidos /
// Documentos e Perfil pelo avatar. Sessão de 180 dias renovada a cada abertura; 401 → sai.
// 2.3.0 (doc 49 §14): notificações (registo ao entrar, tocar abre o ecrã), caixa de Mensagens pelo sino, foto de perfil.
// 2.4.0 (doc 62): 5.º separador Equipa só para chefes de equipa (PIN pedido de novo a cada 12 h, prova só em memória).
// 2.5.0 (canvas 26/28): «Ver o meu PIN» em Hoje (ecrã por cima) e «Esqueci o PIN» na entrada.
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellIcon, CalendarIcon, ChartIcon, ClockIcon, DocumentIcon, TeamIcon } from '../components/icons';
import { QUEUE_RETRY_MS } from '../config';
import { ApiError } from '../http';
import { UpdateRequiredScreen } from '../kiosk/screens/InfoScreens';
import { colors, fonts } from '../theme';
import { DEFAULT_UPDATE_URL, isNewer } from '../update';
import { Dashboard, Me, Notice, NotificationItem, Session, employeeApi } from './api';
import { PushScreen, onPushOpened, onPushReceived, registerForPush, unregisterPush } from './push';
import { clearEmployeeQueue, flushEmployeeQueue, pendingEmployeePunches } from './queue';
import { DocumentsScreen } from './screens/DocumentsScreen';
import { LocationIntroScreen } from './screens/LocationIntroScreen';
import { TermosScreen } from './screens/TermosScreen';
import { LoginScreen, Splash, parseActivationLink } from './screens/LoginScreen';
import { ConfirmRecordsView, MessageView, MissingExitView } from './screens/NotificationViews';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { EsqueciPinScreen } from './screens/EsqueciPinScreen';
import { PinScreen } from './screens/PinScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { TeamPin, TeamScreen } from './screens/TeamScreen';
import { TodayScreen, parseHours } from './screens/TodayScreen';
import { clearSession, getCachedDashboard, getCachedMe, getEmployeeToken, saveCachedDashboard, saveSession } from './storage';
import { Avatar, AvatarPhoto, FadeIn, useToast } from './ui';

/** Ecrãs abertos a partir de uma notificação (artboard p2311-notificacoes). */
type NotifView = { kind: 'mensagem'; id: string } | { kind: 'saida'; date: string } | { kind: 'vistos' };

type Tab = 'today' | 'records' | 'requests' | 'documents' | 'notifications' | 'team';

const TABS: { key: Tab; label: string; Icon: typeof ClockIcon }[] = [
  { key: 'today', label: 'Hoje', Icon: ClockIcon },
  { key: 'records', label: 'Registos', Icon: ChartIcon },
  { key: 'requests', label: 'Pedidos', Icon: CalendarIcon },
  { key: 'documents', label: 'Documentos', Icon: DocumentIcon },
  { key: 'notifications', label: 'Avisos', Icon: BellIcon },
];

const TEAM_TAB = { key: 'team' as Tab, label: 'Equipa', Icon: TeamIcon };

const SPLASH_MS = 1300;

const TAB_OF_PUSH: Record<Exclude<PushScreen, 'mensagens'>, Tab> = { hoje: 'today', registos: 'records', pedidos: 'requests', documentos: 'documents', equipa: 'team' };

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
  const [notifView, setNotifView] = useState<NotifView | null>(null);
  const [reports, setReports] = useState(false);
  const [pinScreen, setPinScreen] = useState(false);
  const [forgotPin, setForgotPin] = useState(false);
  const [contract, setContract] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [locationIntro, setLocationIntro] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [teamPin, setTeamPin] = useState<TeamPin | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  const logout = useCallback(async () => {
    if (token) await unregisterPush(token);
    clearEmployeeQueue();
    await clearSession();
    setMe(null);
    setDashboard(null);
    setTab('today');
    setProfile(false);
    setNotifView(null);
    setPinScreen(false);
    setForgotPin(false);
    setTeamPin(null);
    setToken(null);
  }, [token]);

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
      const fresh = await employeeApi.dashboard(token);
      setDashboard(fresh);
      saveCachedDashboard(fresh);
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
      setDashboard((current) => current ?? getCachedDashboard());
      setPending(pendingEmployeePunches());
      setToken(savedToken && cachedMe ? savedToken : null);
      if (savedToken && cachedMe) {
        employeeApi.renew(savedToken).then(startSession).catch(onAuthError);
      }
    })();
  }, [startSession, onAuthError]);

  // Notificações: regista este telemóvel quando há sessão (pede autorização uma vez).
  useEffect(() => {
    if (token) registerForPush(token);
  }, [token]);

  const openPush = useCallback((screen: PushScreen) => {
    setPinScreen(false);
    setForgotPin(false);
    setProfile(false);
    setContract(null);
    setNotifView(null);
    setTab(screen === 'mensagens' ? 'notifications' : TAB_OF_PUSH[screen]);
  }, []);

  useEffect(() => onPushOpened(openPush), [openPush]);
  useEffect(() => onPushReceived(() => { refreshDashboard(); }), [refreshDashboard]);

  const changeMe = useCallback(async (next: Me) => {
    setMe(next);
    if (token) await saveSession(token, next);
  }, [token]);

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

  // Foto de perfil em base64 (data URI), pedida com a sessão sempre que muda de versão.
  const photoVersion = me?.colaborador.foto_versao ?? null;
  useEffect(() => {
    if (!token || !photoVersion) {
      setPhotoUri(null);
      return;
    }
    let active = true;
    employeeApi.profilePhoto(token, photoVersion)
      .then(({ foto }) => { if (active) setPhotoUri(foto); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [token, photoVersion]);

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
      if (forgotPin) { setForgotPin(false); return true; }
      if (pinScreen) { setPinScreen(false); return true; }
      if (notifView) { setNotifView(null); return true; }
      if (reports && tab === 'records') { setReports(false); return true; }
      if (profile) { setProfile(false); return true; }
      if (contract) { setContract(null); return true; }
      if (tab === 'today') return false;
      setTab('today');
      return true;
    });
    return () => subscription.remove();
  }, [tab, profile, contract, notifView, pinScreen, forgotPin, reports]);

  const openNotice = useCallback((notice: Notice) => {
    setProfile(false);
    setNotifView(null);
    if (notice.acao === 'contrato' && notice.id) {
      setContract(notice.id);
      setTab('documents');
    } else {
      setTab('records');
    }
  }, []);

  /** Cada notificação diz para onde leva (`destino`, do servidor); aqui só se escolhe o separador da app. */
  const openNotification = useCallback((item: NotificationItem) => {
    const [where, id] = item.destino;
    setProfile(false);
    // Cada tipo abre o seu ecrã (artboard p2311-notificacoes): a mensagem lê-se aqui e fica lida; a saída em falta vai direta
    // ao pedido de correção desse dia; os registos por confirmar abrem a confirmação.
    if (where === 'mensagem' && id) { setNotifView({ kind: 'mensagem', id }); return; }
    if (where === 'registos' && id) { setNotifView({ kind: 'saida', date: id }); return; }
    if (where === 'vistos') { setNotifView({ kind: 'vistos' }); return; }
    if (where === 'contrato' && id) setContract(id);
    setTab(where === 'registos' || where === 'vistos' ? 'records' : where === 'pedidos' ? 'requests' : 'documents');
  }, []);

  if (splash) return <><StatusBar style="light" /><Splash /></>;

  if (updateRequired) return <View style={{ flex: 1, backgroundColor: colors.bg }}><UpdateRequiredScreen url={me?.url_atualizacao} /></View>;

  if (token === undefined) {
    return <><StatusBar style="light" /><Splash /></>;
  }

  if (!token || !me) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen link={link} onSession={startSession} onKiosk={onKiosk} />
      </>
    );
  }

  if (me.termos_pendentes) {
    return (
      <>
        <StatusBar style="dark" />
        <TermosScreen token={token} onAuthError={onAuthError} onDone={() => setMe((m) => (m ? { ...m, termos_pendentes: false } : m))} />
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

  const teams = me.chefe?.equipas ?? [];
  const tabs = teams.length ? [...TABS, TEAM_TAB] : TABS;
  // Deixou de ser chefe (ou notificação "equipa" para quem não chefia): volta a Hoje.
  const activeTab: Tab = tab === 'team' && !teams.length ? 'today' : tab;
  const notices = dashboard?.avisos ?? [];
  const updateAvailable = isNewer(me.versao_atual);
  const overlay = forgotPin ? 'forgotPin' : pinScreen ? 'pin' : notifView ? 'notif' : profile ? 'profile' : null;
  const screenKey = overlay ?? activeTab;
  const photo: AvatarPhoto | null = me.colaborador.foto_versao && photoUri ? { uri: photoUri } : null;
  const avatar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surface }}>{me.colaborador.nome.split(/\s+/)[0]}</Text>
      <Avatar name={me.colaborador.nome} count={0} onPress={() => setProfile(true)} photo={photo} size={36} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {toast.node}
      <View style={{ flex: 1 }}>
        <FadeIn deps={screenKey}>
          {forgotPin ? <EsqueciPinScreen token={token} me={me} onBack={() => setForgotPin(false)} onAuthError={onAuthError} onSession={startSession} /> : null}
          {!forgotPin && pinScreen ? <PinScreen token={token} onBack={() => setPinScreen(false)} onAuthError={onAuthError} /> : null}
          {!forgotPin && !pinScreen && notifView ? (
            <>
              {notifView.kind === 'mensagem' ? <MessageView token={token} id={notifView.id} avatar={avatar} onBack={() => setNotifView(null)} onRead={refreshDashboard} onAuthError={onAuthError} /> : null}
              {notifView.kind === 'saida' ? <MissingExitView token={token} date={notifView.date} avatar={avatar} onBack={() => setNotifView(null)} onSent={() => { setNotifView(null); refreshDashboard(); }} onAuthError={onAuthError} /> : null}
              {notifView.kind === 'vistos' ? <ConfirmRecordsView token={token} avatar={avatar} onBack={() => setNotifView(null)} onDone={() => { setNotifView(null); refreshDashboard(); }} onCorrection={() => { setNotifView(null); setTab('records'); }} onAuthError={onAuthError} /> : null}
            </>
          ) : null}
          {!forgotPin && !pinScreen && !notifView && profile ? (
            <ProfileScreen
              token={token}
              me={me}
              photo={photo}
              onMeChange={changeMe}
              onAuthError={onAuthError}
              pending={pending}
              onBack={() => setProfile(false)}
              onLogout={logout}
              onForgotPin={() => setForgotPin(true)}
            />
          ) : null}
          {!overlay && activeTab === 'today' ? (
            <TodayScreen
              token={token}
              me={me}
              dashboard={dashboard}
              online={online}
              pending={pending}
              notices={dashboard?.avisos_total ?? 0}
              urgent={notices[0] ?? null}
              onNotice={openNotice}
              photo={photo}
              onRefresh={refreshDashboard}
              onProfile={() => setProfile(true)}
              onQueued={() => setPending(pendingEmployeePunches())}
              onAuthError={onAuthError}
              onPin={() => setPinScreen(true)}
              toast={toast.show}
            />
          ) : null}
          {!overlay && activeTab === 'records' && reports ? (
            <ReportsScreen token={token} avatar={avatar} onBack={() => setReports(false)} onAuthError={onAuthError} />
          ) : null}
          {!overlay && activeTab === 'records' && !reports ? (
            <RecordsScreen onReports={() => setReports(true)} token={token} name={me.colaborador.nome} photo={photo} onProfile={() => setProfile(true)}
              weeklyMinutes={dashboard?.semana?.carga_texto ? parseHours(dashboard.semana.carga_texto) || null : null}
              onSignMonth={() => setNotifView({ kind: 'vistos' })} onAuthError={onAuthError} />
          ) : null}
          {!overlay && activeTab === 'requests' ? <RequestsScreen token={token} name={me.colaborador.nome} photo={photo} onProfile={() => setProfile(true)} onAuthError={onAuthError} /> : null}
          {!overlay && activeTab === 'documents' ? (
            <DocumentsScreen token={token} me={me} avatar={avatar} openContract={contract} onContractClosed={() => { setContract(null); refreshDashboard(); }} onAuthError={onAuthError} />
          ) : null}
          {!overlay && activeTab === 'notifications' ? (
            <NotificationsScreen token={token} name={me.colaborador.nome} photo={photo} onProfile={() => setProfile(true)} onOpen={openNotification} onChanged={refreshDashboard} onAuthError={onAuthError} />
          ) : null}
          {!overlay && activeTab === 'team' ? (
            <TeamScreen token={token} avatar={avatar} teams={teams} pin={teamPin} onPin={setTeamPin} onAuthError={onAuthError} toast={toast.show} />
          ) : null}
        </FadeIn>
      </View>

      {updateAvailable ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL(me.url_atualizacao || DEFAULT_UPDATE_URL)}
          style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + (overlay ? 14 : 92), zIndex: 4, elevation: 7, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.actionSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.action }}>Nova versão disponível · {me.versao_atual}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.action }}>Toque para atualizar. A sessão mantém-se.</Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.action }}>Atualizar ›</Text>
        </Pressable>
      ) : null}
      {!overlay ? (
        <View
          accessibilityRole="tablist"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6, paddingHorizontal: 2, paddingBottom: insets.bottom + 8 }}
        >
          {tabs.map(({ key, label, Icon }) => {
            const active = activeTab === key;
            const badge = key === 'notifications' ? dashboard?.notificacoes_por_resolver ?? 0 : 0;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={badge ? `${label}, ${badge} por resolver` : label}
                onPress={() => { setTab(key); setContract(null); }}
                style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56, transform: [{ scale: pressed ? 0.96 : 1 }] })}
              >
                {active ? <View style={{ position: 'absolute', top: -7, width: 26, height: 3, borderRadius: 2, backgroundColor: colors.band }} /> : null}
                <View style={{ padding: 4 }}>
                  <Icon size={22} color={active ? colors.band : colors.ink3} />
                  {badge ? (
                    <View style={{ position: 'absolute', top: -2, right: -4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, color: colors.surface }}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ fontFamily: active ? fonts.bodyBold : fonts.bodyMedium, fontSize: 11, color: active ? colors.band : colors.ink3 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
