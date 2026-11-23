import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const STORAGE_KEY = '@produtos';
const TODAS = 'Todas';

const formVazio = {
  nome: '',
  descricao: '',
  preco: '',
  quantidade: '',
  categoria: '',
  marca: '',
  imagem: null, // data URI (base64) para persistir junto com o produto
};

export default function App() {
  const [produtos, setProdutos] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [erros, setErros] = useState({});
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState(TODAS);

  // Carrega os produtos salvos ao abrir o app
  useEffect(() => {
    (async () => {
      try {
        const salvo = await AsyncStorage.getItem(STORAGE_KEY);
        if (salvo) setProdutos(JSON.parse(salvo));
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível carregar os produtos.');
      } finally {
        setCarregado(true);
      }
    })();
  }, []);

  // Salva sempre que a lista mudar (só depois do carregamento inicial)
  useEffect(() => {
    if (!carregado) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(produtos)).catch(() =>
      Alert.alert('Erro', 'Não foi possível salvar os produtos.')
    );
  }, [produtos, carregado]);

  const atualizarCampo = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  };

  const paraNumero = (texto) => Number(String(texto).trim().replace(',', '.'));

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'O nome é obrigatório.';
    if (!form.categoria.trim()) e.categoria = 'A categoria é obrigatória.';

    const qtd = paraNumero(form.quantidade);
    if (form.quantidade.trim() === '' || !Number.isFinite(qtd) || qtd < 0) {
      e.quantidade = 'Informe um número válido maior ou igual a zero.';
    }

    if (form.preco.trim() !== '') {
      const p = paraNumero(form.preco);
      if (!Number.isFinite(p) || p < 0) e.preco = 'Preço inválido.';
    }

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const escolherImagem = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão negada', 'Libere o acesso à galeria para escolher uma imagem.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, // reduz o tamanho para caber no AsyncStorage
      base64: true,
    });
    if (!resultado.canceled) {
      const asset = resultado.assets[0];
      atualizarCampo('imagem', `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
    }
  };

  const cadastrar = () => {
    if (!validar()) return;
    const novo = {
      id: Date.now().toString(),
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      preco: form.preco.trim() === '' ? 0 : paraNumero(form.preco),
      quantidade: Math.floor(paraNumero(form.quantidade)),
      categoria: form.categoria.trim(),
      marca: form.marca.trim(),
      imagem: form.imagem,
    };
    setProdutos((lista) => [novo, ...lista]);
    setForm(formVazio);
    setErros({});
  };

  const remover = (item) => {
    Alert.alert('Remover produto', `Deseja remover "${item.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => setProdutos((lista) => lista.filter((p) => p.id !== item.id)),
      },
    ]);
  };

  // Categorias existentes (sem duplicar, ignorando maiúsculas/minúsculas)
  const categorias = useMemo(() => {
    const mapa = new Map();
    produtos.forEach((p) => {
      const chave = p.categoria.toLowerCase();
      if (!mapa.has(chave)) mapa.set(chave, p.categoria);
    });
    return [TODAS, ...Array.from(mapa.values()).sort((a, b) => a.localeCompare(b))];
  }, [produtos]);

  // Se a categoria filtrada deixar de existir (ex.: removeu o último item), volta para "Todas"
  useEffect(() => {
    if (!categorias.some((c) => c.toLowerCase() === categoriaFiltro.toLowerCase())) {
      setCategoriaFiltro(TODAS);
    }
  }, [categorias, categoriaFiltro]);

  // Busca por nome + filtro por categoria funcionando juntos
  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      const okNome = termo === '' || p.nome.toLowerCase().includes(termo);
      const okCategoria =
        categoriaFiltro === TODAS || p.categoria.toLowerCase() === categoriaFiltro.toLowerCase();
      return okNome && okCategoria;
    });
  }, [produtos, busca, categoriaFiltro]);

  const formatarPreco = (v) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.imagem ? (
        <Image source={{ uri: item.imagem }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbVazio]}>
          <Text style={styles.thumbVazioTxt}>Sem{'\n'}imagem</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardNome} numberOfLines={1}>
          {item.nome}
        </Text>
        <Text style={styles.cardCategoria}>
          {item.categoria}
          {item.marca ? ` • ${item.marca}` : ''}
        </Text>
        {item.descricao ? (
          <Text style={styles.cardDescricao} numberOfLines={2}>
            {item.descricao}
          </Text>
        ) : null}
        <Text style={styles.cardLinha}>
          {formatarPreco(item.preco)} • Qtd: {item.quantidade}
        </Text>
      </View>
      <TouchableOpacity style={styles.btnRemover} onPress={() => remover(item)}>
        <Text style={styles.btnRemoverTxt}>Remover</Text>
      </TouchableOpacity>
    </View>
  );

  const cabecalho = (
    <View>
      <Text style={styles.titulo}>Produtos</Text>

      {/* Formulário */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Novo produto</Text>

        <TextInput
          style={[styles.input, erros.nome && styles.inputErro]}
          placeholder="Nome *"
          value={form.nome}
          onChangeText={(t) => atualizarCampo('nome', t)}
        />
        {erros.nome ? <Text style={styles.erro}>{erros.nome}</Text> : null}

        <TextInput
          style={[styles.input, erros.categoria && styles.inputErro]}
          placeholder="Categoria *"
          value={form.categoria}
          onChangeText={(t) => atualizarCampo('categoria', t)}
        />
        {erros.categoria ? <Text style={styles.erro}>{erros.categoria}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Marca"
          value={form.marca}
          onChangeText={(t) => atualizarCampo('marca', t)}
        />

        <TextInput
          style={[styles.input, styles.inputMultilinha]}
          placeholder="Descrição"
          value={form.descricao}
          onChangeText={(t) => atualizarCampo('descricao', t)}
          multiline
        />

        <View style={styles.linha}>
          <View style={styles.metade}>
            <TextInput
              style={[styles.input, erros.preco && styles.inputErro]}
              placeholder="Preço (R$)"
              keyboardType="decimal-pad"
              value={form.preco}
              onChangeText={(t) => atualizarCampo('preco', t)}
            />
            {erros.preco ? <Text style={styles.erro}>{erros.preco}</Text> : null}
          </View>
          <View style={styles.metade}>
            <TextInput
              style={[styles.input, erros.quantidade && styles.inputErro]}
              placeholder="Quantidade *"
              keyboardType="numeric"
              value={form.quantidade}
              onChangeText={(t) => atualizarCampo('quantidade', t)}
            />
            {erros.quantidade ? <Text style={styles.erro}>{erros.quantidade}</Text> : null}
          </View>
        </View>

        <View style={styles.linhaImagem}>
          <TouchableOpacity style={styles.btnSecundario} onPress={escolherImagem}>
            <Text style={styles.btnSecundarioTxt}>
              {form.imagem ? 'Trocar imagem' : 'Escolher imagem'}
            </Text>
          </TouchableOpacity>
          {form.imagem ? (
            <>
              <Image source={{ uri: form.imagem }} style={styles.preview} />
              <TouchableOpacity onPress={() => atualizarCampo('imagem', null)}>
                <Text style={styles.linkRemover}>Remover</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <TouchableOpacity style={styles.btnPrimario} onPress={cadastrar}>
          <Text style={styles.btnPrimarioTxt}>Cadastrar</Text>
        </TouchableOpacity>
      </View>

      {/* Busca e filtro */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Consultar</Text>
        <TextInput
          style={styles.input}
          placeholder="Buscar por nome"
          value={busca}
          onChangeText={setBusca}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categorias.map((cat) => {
            const ativo = cat.toLowerCase() === categoriaFiltro.toLowerCase();
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setCategoriaFiltro(cat)}
              >
                <Text style={[styles.chipTxt, ativo && styles.chipTxtAtivo]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.contador}>
          {produtosFiltrados.length} de {produtos.length} produto(s)
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={produtosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={
            carregado ? (
              <Text style={styles.vazio}>
                {produtos.length === 0
                  ? 'Nenhum produto cadastrado ainda.'
                  : 'Nenhum produto encontrado para a busca/filtro informado.'}
              </Text>
            ) : null
          }
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', paddingTop: Platform.OS === 'android' ? 24 : 0 },
  lista: { padding: 16, paddingBottom: 40 },
  titulo: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 12 },
  secao: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
  },
  secaoTitulo: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  inputMultilinha: { minHeight: 64, textAlignVertical: 'top' },
  inputErro: { borderColor: '#dc2626' },
  erro: { color: '#dc2626', fontSize: 12, marginTop: -4, marginBottom: 8 },
  linha: { flexDirection: 'row', gap: 8 },
  metade: { flex: 1 },
  linhaImagem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  preview: { width: 48, height: 48, borderRadius: 8 },
  linkRemover: { color: '#dc2626', fontSize: 13 },
  btnPrimario: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimarioTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSecundario: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnSecundarioTxt: { color: '#2563eb', fontWeight: '500' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  chipAtivo: { backgroundColor: '#2563eb' },
  chipTxt: { color: '#374151' },
  chipTxtAtivo: { color: '#fff', fontWeight: '600' },
  contador: { marginTop: 10, color: '#6b7280', fontSize: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 1,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: 10 },
  thumbVazio: { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  thumbVazioTxt: { fontSize: 10, color: '#6b7280', textAlign: 'center' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardCategoria: { fontSize: 12, color: '#2563eb', marginBottom: 2 },
  cardDescricao: { fontSize: 13, color: '#4b5563' },
  cardLinha: { fontSize: 13, color: '#111827', marginTop: 2, fontWeight: '500' },
  btnRemover: { paddingHorizontal: 8, paddingVertical: 6 },
  btnRemoverTxt: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  vazio: { textAlign: 'center', color: '#6b7280', marginTop: 20, fontSize: 15 },
});
