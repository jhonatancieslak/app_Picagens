// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Modo quiosque da app Picagens: tablet partilhado à entrada da obra. Picagem com PIN + foto de confirmação
// (sem reconhecimento facial), fila offline, administração com código e estado da licença.
// Fluxo e decisões: doc 44 §14 (UI) e doc 43 §4 (API) no repo picagens-saas-v2.
import NetInfo from '@react-native-community/netinfo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';

import { ApiError, KioskConfig, NetworkError, api } from './api';
import { TopBar } from './TopBar';
import { useVw } from '../components/ui';
import { ADMIN_SESSION_SECONDS, CONFIG_REFRESH_MS, PHOTO_RETENTION_DAYS_DEFAULT, QUEUE_RETRY_MS } from '../config';
import { QueueStatus, clearQueue, enqueuePunch, flushQueue, purgeExpiredQueue, queueStatus } from './queue';
import { AdminScreen, CameraTestScreen, ScreenSettingsScreen } from './screens/AdminScreens';
import { DoneInfo, DoneScreen } from './screens/DoneScreen';
import { DEFAULT_UPDATE_URL, isNewer } from '../update';
import { PhotoInfoScreen, SuspendedScreen, UpdateRequiredScreen } from './screens/InfoScreens';
import { PadScreen } from './screens/PadScreen';
import { PhotoScreen } from './screens/PhotoScreen';
import { SetupScreen } from './screens/SetupScreen';
import { WaitScreen } from './screens/WaitScreen';
import {
  DEFAULT_SCREEN_SETTINGS, ScreenSettings, clearAll, getCachedConfig, getScreenSettings, getToken,
  saveCachedConfig, saveScreenSettings, saveToken,
} from './storage';
import { colors, fonts } from '../theme';

type Screen = 'wait' | 'pin' | 'photo' | 'done' | 'adminCode' | 'admin' | 'camera' | 'screenSettings' | 'info';

const NIGHT_START_HOUR = 20;
const NIGHT_END_HOUR = 6;
const WAKE_MS = 2 * 60 * 1000;
const isNight = (date: Date) => date.getHours() >= NIGHT_START_HOUR || date.getHours() < NIGHT_END_HOUR;

interface Props {
  /** Tablet desligado da empresa (ou configuração cancelada): volta à escolha do modo. */
  onLeave: () => void;
}

export function KioskApp({ onLeave }: Props) {
  const vw = useVw();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [online, setOnline] = useState(true);
  const [screen, setScreen] = useState<Screen>('wait');
  const [padError, setPadError] = useState('');
  const [padBusy, setPadBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [queue, setQueue] = useState<QueueStatus>({ pending: 0, rejected: 0 });
  const [settings, setSettings] = useState<ScreenSettings>(DEFAULT_SCREEN_SETTINGS);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [adminLeft, setAdminLeft] = useState(0);
  const [wokeAt, setWokeAt] = useState(0);
  const [clock, setClock] = useState(new Date());
  const pin = useRef('');

  const unlink = useCallback(async () => {
    await clearQueue();
    await clearAll();
    onLeave();
  }, [onLeave]);

  /** 401 = tablet desativado no painel; 426 = versão antiga. Devolve true se o erro foi tratado. */
  const handleAuthErrors = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      unlink();
      return true;
    }
    if (error instanceof ApiError && error.status === 426) {
      setUpdateRequired(true);
      return true;
    }
    return false;
  }, [unlink]);

  const refreshConfig = useCallback(async (currentToken: string) => {
    try {
      const fresh = await api.config(currentToken);
      setConfig(fresh);
      await saveCachedConfig(fresh);
    } catch (error) {
      handleAuthErrors(error);
    }
  }, [handleAuthErrors]);

  const sendQueue = useCallback(async () => {
    if (!token) return;
    setQueue(await flushQueue(token));
  }, [token]);

  // Arranque: token, configuração guardada e preferências do ecrã.
  useEffect(() => {
    (async () => {
      await purgeExpiredQueue();
      const [savedToken, cached, savedSettings] = await Promise.all([getToken(), getCachedConfig(), getScreenSettings()]);
      setSettings(savedSettings);
      setConfig(cached);
      setQueue(queueStatus());
      setToken(savedToken);
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    refreshConfig(token);
    const timer = setInterval(() => refreshConfig(token), CONFIG_REFRESH_MS);
    return () => clearInterval(timer);
  }, [token, refreshConfig]);

  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))), []);

  useEffect(() => {
    if (!online || !token) return;
    sendQueue();
    const timer = setInterval(sendQueue, QUEUE_RETRY_MS);
    return () => clearInterval(timer);
  }, [online, token, sendQueue]);

  useEffect(() => {
    if (settings.keepAwake) activateKeepAwakeAsync('quiosque');
    else deactivateKeepAwake('quiosque');
  }, [settings.keepAwake]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Botão "voltar" do Android nunca fecha a app do quiosque: volta ao ecrã de espera.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen((current) => (['camera', 'screenSettings'].includes(current) ? 'admin' : 'wait'));
      return true;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!['admin', 'camera', 'screenSettings'].includes(screen) || adminLeft <= 0) return;
    const timer = setTimeout(() => {
      if (adminLeft <= 1) setScreen('wait');
      setAdminLeft((left) => left - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [screen, adminLeft]);

  const openPad = (next: 'pin' | 'adminCode') => {
    setPadError('');
    setPadBusy(false);
    setScreen(next);
  };

  async function submitAdminCode(code: string) {
    if (!token) return;
    if (!online) {
      setPadError('Sem rede: o código de administrador precisa de internet.');
      return;
    }
    setPadBusy(true);
    try {
      await api.adminLogin(token, code);
      setAdminLeft(ADMIN_SESSION_SECONDS);
      setQueue(queueStatus());
      setScreen('admin');
    } catch (error) {
      if (handleAuthErrors(error)) return;
      setPadError(error instanceof ApiError ? error.message : 'Sem ligação. Tente de novo.');
    } finally {
      setPadBusy(false);
    }
  }

  function finishPunch(info: DoneInfo) {
    setDone(info);
    setSending(false);
    setScreen('done');
  }

  async function queueOffline(photo: string | null) {
    await enqueuePunch(pin.current, photo);
    pin.current = '';
    setQueue(queueStatus());
    finishPunch({ kind: 'queued', label: 'Picagem guardada', message: 'Sem rede: fica no tablet e é enviada sozinha quando houver ligação.', photoSaved: Boolean(photo) });
  }

  async function submitPhoto(photo: string | null) {
    if (!token) return;
    setSending(true);
    if (!online) return queueOffline(photo);
    try {
      const result = await api.punch(token, { pin: pin.current, foto: photo });
      finishPunch({
        kind: result.foto ? 'ok' : 'no_photo',
        name: result.nome,
        label: `${result.rotulo} · ${result.hora}`,
        message: result.foto ? 'Registada. Bom trabalho!' : 'Registada sem foto. Fica marcada para o gestor rever.',
        photoSaved: result.foto,
      });
    } catch (error) {
      setSending(false);
      if (error instanceof NetworkError) return queueOffline(photo);
      if (handleAuthErrors(error)) return;
      if (error instanceof ApiError && (error.status === 404 || error.status === 429)) {
        setPadError(error.status === 404 ? 'PIN inválido. Tente de novo.' : error.message);
        setScreen('pin');
        return;
      }
      finishPunch({ kind: 'refused', label: 'Não foi possível registar', message: error instanceof ApiError ? error.message : 'Tente de novo.', photoSaved: false });
    } finally {
      pin.current = '';
    }
  }

  function changeSettings(next: ScreenSettings) {
    setSettings(next);
    saveScreenSettings(next);
  }

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (updateRequired) return <Shell><UpdateRequiredScreen url={config?.url_atualizacao} /></Shell>;
  if (!token) return <Shell><SetupScreen onBack={onLeave} onActivated={async (newToken) => { await saveToken(newToken); setToken(newToken); }} /></Shell>;
  if (!config) {
    return (
      <Shell>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.action} />
          <Text style={{ fontFamily: fonts.body, color: colors.ink2 }}>{online ? 'A carregar a configuração…' : 'Sem rede. A aguardar ligação…'}</Text>
        </View>
      </Shell>
    );
  }

  const license = config.licenca?.estado ?? 'ativa';
  const inAdmin = ['admin', 'camera', 'screenSettings'].includes(screen);
  const dimmed = settings.dimAtNight && isNight(clock) && Date.now() - wokeAt > WAKE_MS;

  if (license === 'suspensa' && !inAdmin && screen !== 'adminCode') {
    return <Shell><SuspendedScreen onAdmin={() => openPad('adminCode')} /></Shell>;
  }

  return (
    <Shell>
      {screen !== 'done' ? <TopBar company={config.empresa} place={config.local} online={online} onAdmin={inAdmin ? undefined : () => openPad('adminCode')} /> : null}
      {screen === 'wait' ? (
        <WaitScreen tabletName={config.tablet} place={config.local} address={config.local_morada ?? null} onPin={() => openPad('pin')} onInfo={() => setScreen('info')} dimmed={dimmed} onWake={() => setWokeAt(Date.now())} />
      ) : null}
      {screen === 'pin' || screen === 'adminCode' ? (
        <PadScreen
          key={screen}
          mode={screen === 'pin' ? 'pin' : 'admin'}
          error={padError}
          busy={padBusy}
          onBack={() => setScreen('wait')}
          onSubmit={(code) => {
            if (screen === 'adminCode') return submitAdminCode(code);
            pin.current = code;
            setPadError('');
            setScreen('photo');
          }}
        />
      ) : null}
      {screen === 'photo' ? <PhotoScreen sending={sending} onPhoto={submitPhoto} /> : null}
      {screen === 'done' && done ? <DoneScreen info={done} onClose={() => setScreen('wait')} /> : null}
      {screen === 'info' ? (
        <PhotoInfoScreen company={config.empresa} retentionDays={config.foto?.retencao_dias ?? PHOTO_RETENTION_DAYS_DEFAULT} onBack={() => setScreen('wait')} />
      ) : null}
      {screen === 'admin' ? (
        <AdminScreen
          secondsLeft={adminLeft}
          license={license}
          licenseUntil={config.licenca?.ate ?? null}
          queue={queue}
          settings={settings}
          tabletName={config.tablet}
          update={isNewer(config.versao_atual) ? { version: config.versao_atual!, url: config.url_atualizacao || DEFAULT_UPDATE_URL } : null}
          onCamera={() => setScreen('camera')}
          onScreen={() => setScreen('screenSettings')}
          onFlush={sendQueue}
          onExit={() => { setAdminLeft(0); setScreen('wait'); }}
        />
      ) : null}
      {screen === 'camera' ? <CameraTestScreen onBack={() => setScreen('admin')} /> : null}
      {screen === 'screenSettings' ? (
        <ScreenSettingsScreen settings={settings} onChange={changeSettings} onUnlink={unlink} onBack={() => setScreen('admin')} />
      ) : null}
      {license === 'em_atraso' && screen !== 'done' ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.warnSoft, padding: vw(1.2), alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: vw(1.55), color: colors.warn }}>
            Licença por renovar. As picagens continuam a contar{config.licenca.ate ? ` até ${config.licenca.ate.split('-').reverse().join('/')}` : ''}. Avise o responsável da obra.
          </Text>
        </View>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar hidden />
      {children}
    </View>
  );
}
