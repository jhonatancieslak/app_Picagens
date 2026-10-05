// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Perfil › Fotos das picagens no tablet (doc 44 §14, ponto 4): o colaborador vê as fotos de confirmação das suas
// picagens enquanto existem (30 dias). Cada foto só se descarrega quando se toca, com a sessão e sem cache
// (o servidor regista na auditoria); ao sair do ecrã a imagem deixa de estar em memória.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon } from '../../components/icons';
import { ApiError, NetworkError, appVersion } from '../../http';
import { colors, fonts } from '../../theme';
import { Photos, employeeApi } from '../api';
import { BackLink, Card, Muted, Row, Title } from '../ui';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const dayLabel = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]}, ${day} ${MONTHS[month - 1]}`;
};

export function PhotosScreen({ token, company, onBack, onAuthError }: { token: string; company: string; onBack: () => void; onAuthError: (error: unknown) => boolean }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Photos | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await employeeApi.photos(token));
    } catch (exc) {
      if (!onAuthError(exc)) setError(exc instanceof NetworkError ? 'Sem rede. Tente quando houver ligação.' : exc instanceof ApiError ? exc.message : 'Não foi possível carregar.');
    }
  }, [token, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 40, gap: 12 }}>
      <BackLink label="Perfil" onPress={onBack} />
      <Title size={24}>Fotos das picagens no tablet</Title>
      <Muted size={13.5}>
        Quando pica no tablet da obra, ele tira uma foto para confirmar que foi mesmo você. Não há reconhecimento facial:
        a foto não é analisada por nenhum programa. Só o gestor da {company} a vê, para rever uma picagem. Fica guardada
        cifrada {data?.retencao_dias ?? 30} dias e depois é apagada; a hora da picagem fica.
      </Muted>
      {error ? <Muted>{error}</Muted> : null}
      {!data && !error ? <ActivityIndicator color={colors.action} /> : null}
      {data && !data.fotos.length ? <Muted>Não há fotos suas guardadas neste momento.</Muted> : null}
      {data?.fotos.length ? (
        <Card>
          {data.fotos.map((photo, index) => (
            <View key={photo.id}>
              <Row
                first={index === 0}
                onPress={() => setOpen(open === photo.id ? null : photo.id)}
                left={(
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.actionSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <CameraIcon size={18} color={colors.action} />
                  </View>
                )}
                title={`${dayLabel(photo.data)} · ${photo.hora}`}
                subtitle={`${photo.rotulo} · apagada a ${dayLabel(photo.apaga_em)}`}
                right={<Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.action }}>{open === photo.id ? 'Fechar' : 'Ver'}</Text>}
              />
              {open === photo.id ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  <Image
                    accessibilityLabel={`Foto da picagem de ${dayLabel(photo.data)} às ${photo.hora}`}
                    source={{ uri: employeeApi.photoUrl(photo.id), headers: { Authorization: `Bearer ${token}`, 'X-App-Versao': appVersion }, cache: 'reload' }}
                    style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: colors.line }}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
      <Muted size={12.5}>Quer uma cópia das suas fotos ou dos seus dados? Peça ao RH da {company}.</Muted>
    </ScrollView>
  );
}
