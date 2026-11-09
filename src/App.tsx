import { useEffect, useMemo, useState } from 'react';
import {
  Package, Search, Plus, Pencil, Trash2, Download, Store, LayoutDashboard,
  ArrowLeft, ImagePlus, X, ExternalLink, ShoppingCart, Minus, Plus as PlusIcon,
  Trash, ShoppingBag, CreditCard, CheckCircle2, ChevronRight
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from './lib/supabase';

type Product = {
  id: string;
  name: string;
  shortDescription?: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  maxInstallments?: number;
  active?: boolean;
};
type CartItem = { productId: string; quantity: number };

const CART_KEY = 'minha-loja-carrinho-v1';
type DbProduct = { id: string; name: string; short_description: string; description: string; price_cents: number; category: string; image: string; stock: number; max_installments: number; active: boolean };
const fromDb = (p: DbProduct): Product => ({ id:p.id, name:p.name, shortDescription:p.short_description, description:p.description, price:p.price_cents/100, category:p.category, image:p.image, stock:p.stock, maxInstallments:p.max_installments, active:p.active });
const toDb = (p: Product): DbProduct => ({ id:p.id, name:p.name.trim(), short_description:p.shortDescription ?? '', description:p.description, price_cents:Math.round(p.price*100), category:p.category, image:p.image, stock:p.stock, max_installments:p.maxInstallments ?? 1, active:p.active ?? true });
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function readStorage<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => readStorage(CART_KEY, []));
  const [admin, setAdmin] = useState(location.hash === '#admin');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [editing, setEditing] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [notice, setNotice] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  async function loadProducts() {
    setLoadingCatalog(true);
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending:false });
    if (error) setNotice(`Falha ao carregar catálogo: ${error.message}`);
    else setProducts((data ?? []).map(p => fromDb(p as DbProduct)));
    setLoadingCatalog(false);
  }
  useEffect(() => {
    void loadProducts();
    void supabase.auth.getUser().then(({data}) => {
      setSessionUser(data.user?.id ?? null);
      setEmailConfirmed(Boolean(data.user?.email_confirmed_at));
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => {
      setSessionUser(session?.user?.id ?? null);
      setEmailConfirmed(Boolean(session?.user?.email_confirmed_at));
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      setAuthLoading(true);
      if (!sessionUser || !emailConfirmed) { setIsAdmin(false); setAuthLoading(false); return; }
      const {data,error} = await supabase.from('admin_users').select('user_id').eq('user_id',sessionUser).maybeSingle();
      if (!cancelled) { setIsAdmin(!error && !!data); setAuthLoading(false); void loadProducts(); }
    }
    void checkAdmin();
    return () => { cancelled = true; };
  }, [sessionUser, emailConfirmed]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(''); setAuthNotice(''); setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setAuthError('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou reenvie o link abaixo.');
        return;
      }
      setSessionUser(data.user.id);
      setEmailConfirmed(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setAuthError(message.toLowerCase().includes('email not confirmed')
        ? 'E-mail ainda não confirmado. Confira sua caixa de entrada ou reenvie a confirmação.'
        : 'Não foi possível entrar. Confira e-mail, senha e confirmação da conta.');
    } finally {
      setAuthLoading(false);
      setPassword('');
    }
  }
  async function resendConfirmation() {
    if (!email.trim()) { setAuthError('Informe seu e-mail para reenviar a confirmação.'); return; }
    setResending(true); setAuthError(''); setAuthNotice('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/#admin` }
      });
      if (error) throw error;
      setAuthNotice('Se a conta estiver elegível, enviaremos um novo link. Confira também a pasta de spam.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha ao reenviar a confirmação.');
    } finally { setResending(false); }
  }
  async function logout() {
    await supabase.auth.signOut();
    setIsAdmin(false); setSessionUser(null); setEmailConfirmed(false);
  }
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    const sync = () => { setAdmin(location.hash === '#admin'); if (location.hash === '#admin') { setCheckout(false); setCartOpen(false); setSelected(null); } };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.filter(p => admin || p.active !== false).map(p => p.category).filter(Boolean)))], [products,admin]);
  const visible = products.filter(p => p.active !== false && (category === 'Todas' || p.category === category) &&
    (`${p.name} ${p.shortDescription ?? ''} ${p.description} ${p.category}`).toLowerCase().includes(query.toLowerCase()));
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartDetails = cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) }))
    .filter((item): item is CartItem & { product: Product } => Boolean(item.product));
  const cartTotal = cartDetails.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  async function save(p: Product) {
    if (!isAdmin || saving) return;
    if (!p.name.trim() || !Number.isFinite(p.price) || p.price < 1 || !Number.isInteger(p.stock) || p.stock < 0) {
      alert('Informe nome, preço de pelo menos R$ 1 e estoque válido.'); return;
    }
    setSaving(true);
    try {
      let image = p.image;
      if (image.startsWith('data:')) {
        const response = await fetch(image);
        const blob = await response.blob();
        const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${crypto.randomUUID()}.${extension}`;
        const {error:uploadError} = await supabase.storage.from('product-images').upload(path,blob,{contentType:blob.type,upsert:false});
        if (uploadError) throw uploadError;
        image = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      const {error} = await supabase.from('products').upsert(toDb({...p,image}));
      if (error) throw error;
      setEditing(null); setNotice('Produto salvo no Supabase.'); await loadProducts();
    } catch(e) { alert(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!isAdmin || !confirm('Tem certeza que deseja remover este produto?')) return;
    const {error} = await supabase.from('products').delete().eq('id',id);
    if (error) { alert(`Erro ao excluir: ${error.message}`); return; }
    setCart(old => old.filter(item => item.productId !== id)); await loadProducts();
  }
  function addToCart(product: Product, quantity = 1) {
    if (product.stock <= 0) { alert('Este produto está sem estoque.'); return; }
    setCart(old => {
      const existing = old.find(item => item.productId === product.id);
      const current = existing?.quantity ?? 0;
      if (current + quantity > product.stock) { alert(`Estoque disponível: ${product.stock} unidade(s).`); return old; }
      return existing
        ? old.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item)
        : [...old, { productId: product.id, quantity }];
    });
    setSelected(null); setNotice(`${product.name} adicionado ao carrinho.`); window.setTimeout(() => setNotice(''), 2200);
  }
  function changeQuantity(id: string, quantity: number) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    if (quantity <= 0) { setCart(old => old.filter(item => item.productId !== id)); return; }
    if (quantity > product.stock) { alert(`Estoque disponível: ${product.stock} unidade(s).`); return; }
    setCart(old => old.map(item => item.productId === id ? { ...item, quantity } : item));
  }
  function buyNow(product: Product) {
    if (product.stock <= 0) { alert('Este produto está sem estoque.'); return; }
    setCart([{ productId: product.id, quantity: 1 }]);
    setSelected(null); setCartOpen(false); setCheckout(true);
  }
  function goCheckout() {
    if (!cartDetails.length) return;
    setCartOpen(false); setSelected(null); setCheckout(true);
  }
  async function exportExcel() {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Produtos');
    ws.columns = [
      {header:'Produto',key:'name',width:30}, {header:'Descrição curta',key:'short',width:45},
      {header:'Descrição completa',key:'description',width:60}, {header:'Preço (R$)',key:'price',width:16},
      {header:'Categoria',key:'category',width:24}, {header:'Estoque',key:'stock',width:14},
      {header:'Máximo de parcelas',key:'installments',width:20}, {header:'Ativo',key:'active',width:12}
    ];
    products.forEach(p => ws.addRow({name:p.name,short:p.shortDescription ?? '',description:p.description,price:p.price,category:p.category,stock:p.stock,installments:p.maxInstallments ?? 1,active:p.active !== false ? 'Sim':'Não'}));
    ws.getRow(1).font = {bold:true};
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a = document.createElement('a'); a.href=url; a.download='catalogo-da-loja.xlsx'; a.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  return <div className="app">
    {admin && (authLoading || !sessionUser || !emailConfirmed || !isAdmin) ? <main className="admin-wrap"><section className="panel" style={{maxWidth:480,margin:'60px auto',padding:28}}>
      <h1>Área administrativa</h1>
      {authLoading ? <p>Verificando acesso...</p> : !sessionUser ? <form onSubmit={login} style={{display:'grid',gap:14}}>
        <label>E-mail<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Senha<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
        {authError && <p role="alert" style={{color:'#b42318'}}>{authError}</p>}
        {authNotice && <p role="status">{authNotice}</p>}
        <button className="btn primary" type="submit">Entrar</button>
        <button className="btn secondary" type="button" disabled={resending} onClick={resendConfirmation}>{resending ? 'Enviando...' : 'Reenviar e-mail de confirmação'}</button>
      </form> : <><p>Esta conta não tem permissão administrativa.</p><button className="btn secondary" onClick={logout}>Sair da conta</button></>}
      <p><a href="#">Voltar à loja</a></p>
    </section></main> : admin ? <>
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-icon"><Store size={21} /></span><span>Minha Loja <small>PAINEL ADMINISTRATIVO</small></span></a>
        <div style={{display:"flex",gap:12,alignItems:"center"}}><a className="back-link" href="#"><ArrowLeft size={17} /> Ver loja</a><button className="btn secondary" onClick={logout}>Sair</button></div>
      </header>
      <main className="admin-wrap">
        <div className="page-heading"><div><span className="eyebrow">GERENCIAMENTO</span><h1>Painel de produtos</h1><p>{'Catálogo conectado ao Supabase. Alterações salvas para todos os visitantes.'}</p></div><button className="btn secondary" onClick={exportExcel}><Download size={17} /> Exportar Excel</button></div>
        <div className="stats"><div className="stat"><Package /><span>Produtos cadastrados</span><strong>{products.length}</strong></div><div className="stat"><LayoutDashboard /><span>Categorias</span><strong>{categories.length - 1}</strong></div><div className="stat"><Download /><span>Planilha</span><strong>XLSX</strong></div></div>
        <section className="panel">
          <div className="panel-head"><div><h2>Seus produtos</h2><p>As alterações aparecem automaticamente na página da loja.</p></div><button className="btn primary" onClick={() => setEditing({ id: crypto.randomUUID(), active:true, name: '', shortDescription: '', description: '', price: 0, category: 'Geral', image: '', stock: 0, maxInstallments: 1 })}><Plus size={18} /> Adicionar produto</button></div>
          {notice && <div className="notice">{notice}</div>}
          <label style={{display:'block',padding:'10px 0'}}><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} /> Mostrar produtos inativos</label>
          <div className="table-scroll"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>
            {products.filter(p => showInactive || p.active !== false).map(p => <tr key={p.id}><td><div className="product-cell">{p.image ? <img src={p.image} alt="" /> : <div className="mini-placeholder"><Package /></div>}<div><b>{p.name || 'Sem nome'}</b><small>{(p.shortDescription || p.description).slice(0, 55)}</small></div></div></td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.stock}</td><td><div className="actions"><button title="Editar" onClick={() => setEditing({ ...p })}><Pencil size={17} /></button><button title="Remover" className="danger" onClick={() => remove(p.id)}><Trash2 size={17} /></button></div></td></tr>)}
          </tbody></table>{!products.length && <div className="empty">Nenhum produto cadastrado. Clique em “Adicionar produto” para começar.</div>}</div>
        </section>
        <p className="privacy-note">Produtos salvos no Supabase. Exporte periodicamente uma cópia de segurança.</p>
      </main>
      {editing && <ProductModal product={editing} saving={saving} onSave={save} onClose={() => setEditing(null)} />}
    </> : <>
      <header className="hero">
        <nav className="nav">
          <a className="brand light" href="#"><span className="brand-icon"><Store size={21} /></span><span>Minha Loja<small>SEU CATÁLOGO ONLINE</small></span></a>
          <div className="nav-actions"><button className="cart-trigger" onClick={() => setCartOpen(true)}><ShoppingCart size={18} /><span>Carrinho</span><b>{cartCount}</b></button><a className="admin-link" href="#admin">Área administrativa <ExternalLink size={15} /></a></div>
        </nav>
        <div className="hero-content"><span className="eyebrow light-text">BEM-VINDO(A) À NOSSA LOJA</span><h1>Encontre o que você<br /><em>está procurando.</em></h1><p>Conheça nossos produtos e escolha seu próximo favorito.</p><a className="hero-cta" href="#catalogo">Ver produtos <ArrowLeft size={17} /></a></div>
        <div className="hero-orb orb1" /><div className="hero-orb orb2" />
      </header>
      <main className="store-wrap" id="catalogo">{loadingCatalog && <p>Carregando produtos...</p>}
        <div className="section-title"><div><span className="eyebrow">NOSSO CATÁLOGO</span><h2>Produtos disponíveis</h2><p>Confira nossa seleção e encontre o produto ideal.</p></div><span className="count">{products.length} produtos</span></div>
        {notice && <div className="notice store-notice">{notice}</div>}
        <div className="filters"><div className="search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto..." /></div><div className="chips">{categories.map(c => <button key={c} className={category === c ? 'chip active' : 'chip'} onClick={() => setCategory(c)}>{c}</button>)}</div></div>
        <div className="product-grid">
          {visible.map(p => <article className="product-card" key={p.id}>
            <button className="product-card-open" onClick={() => setSelected(p)} aria-label={`Ver detalhes de ${p.name}`}>
              <div className="product-image">{p.image ? <img src={p.image} alt={p.name} /> : <div className="image-empty"><Package size={35} /><span>Foto do produto</span></div>}{p.category && <span className="tag">{p.category}</span>}</div>
              <div className="product-info"><h3>{p.name}</h3><p>{p.shortDescription || p.description}</p><div className="product-bottom"><strong>{money(p.price)}</strong><span className={p.stock > 0 ? '' : 'out-stock'}>{p.stock > 0 ? 'Disponível' : 'Sem estoque'}</span></div></div>
            </button>
            <div className="card-actions"><button className="btn secondary" disabled={p.stock <= 0} onClick={() => addToCart(p)}><ShoppingCart size={15} /> Adicionar</button><button className="btn primary" disabled={p.stock <= 0} onClick={() => buyNow(p)}>Comprar agora <ChevronRight size={15} /></button></div>
          </article>)}
        </div>
        {!visible.length && <div className="empty public-empty">Nenhum produto encontrado. Tente outra busca ou categoria.</div>}
      </main>
      <footer><div className="footer-inner"><a className="brand" href="#"><span className="brand-icon"><Store size={19} /></span><span>Minha Loja</span></a><span>© {new Date().getFullYear()} Minha Loja. Todos os direitos reservados.</span><a href="#admin">Gerenciar catálogo</a></div></footer>
      {selected && <ProductDetails product={selected} onClose={() => setSelected(null)} onAdd={() => addToCart(selected)} onBuy={() => buyNow(selected)} />}
      {cartOpen && <CartModal items={cartDetails} total={cartTotal} onClose={() => setCartOpen(false)} onChange={changeQuantity} onRemove={id => setCart(old => old.filter(item => item.productId !== id))} onCheckout={goCheckout} />}
      {checkout && <Checkout items={cartDetails} total={cartTotal} onBack={() => { setCheckout(false); setCartOpen(true); }} onClose={() => setCheckout(false)} />}
    </>}
  </div>;
}

function ProductDetails({ product, onClose, onAdd, onBuy }: { product: Product; onClose: () => void; onAdd: () => void; onBuy: () => void }) {
  return <div className="modal-backdrop detail-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="detail-modal" role="dialog" aria-modal="true" aria-label={`Detalhes de ${product.name}`}>
    <button className="close detail-close" onClick={onClose} aria-label="Fechar"><X /></button>
    <div className="detail-image">{product.image ? <img src={product.image} alt={product.name} /> : <div className="image-empty"><Package size={48} /><span>Foto do produto</span></div>}</div>
    <div className="detail-content"><span className="eyebrow">{product.category || 'PRODUTO'}</span><h2>{product.name}</h2><strong className="detail-price">{money(product.price)}</strong><p className="detail-description">{product.description || product.shortDescription || 'Sem descrição adicional.'}</p><div className="detail-stock">{product.stock > 0 ? `${product.stock} unidade(s) disponível(is)` : 'Produto sem estoque'}</div><div className="detail-actions"><button className="btn secondary" disabled={product.stock <= 0} onClick={onAdd}><ShoppingCart size={17} /> Adicionar ao carrinho</button><button className="btn primary" disabled={product.stock <= 0} onClick={onBuy}>Comprar agora <ChevronRight size={16} /></button></div></div>
  </section></div>;
}

function CartModal({ items, total, onClose, onChange, onRemove, onCheckout }: { items: (CartItem & { product: Product })[]; total: number; onClose: () => void; onChange: (id: string, quantity: number) => void; onRemove: (id: string) => void; onCheckout: () => void }) {
  return <div className="modal-backdrop cart-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="cart-modal" role="dialog" aria-modal="true" aria-label="Carrinho de compras">
    <div className="cart-head"><div><span className="eyebrow">SUA COMPRA</span><h2><ShoppingCart size={21} /> Carrinho</h2></div><button className="close" onClick={onClose}><X /></button></div>
    {!items.length ? <div className="cart-empty"><ShoppingBag size={42} /><h3>Seu carrinho está vazio</h3><p>Adicione produtos para continuar.</p><button className="btn primary" onClick={onClose}>Ver produtos</button></div> : <>
      <div className="cart-items">{items.map(({ product, quantity }) => <div className="cart-item" key={product.id}><div className="cart-thumb">{product.image ? <img src={product.image} alt="" /> : <Package />}</div><div className="cart-item-info"><b>{product.name}</b><span>{money(product.price)}</span><div className="quantity-control"><button onClick={() => onChange(product.id, quantity - 1)} aria-label="Diminuir"><Minus size={14} /></button><span>{quantity}</span><button onClick={() => onChange(product.id, quantity + 1)} aria-label="Aumentar"><PlusIcon size={14} /></button></div></div><div className="cart-item-end"><b>{money(product.price * quantity)}</b><button className="remove-cart" onClick={() => onRemove(product.id)}><Trash size={15} /> Remover</button></div></div>)}</div>
      <div className="cart-summary"><div><span>Subtotal</span><b>{money(total)}</b></div><small>O frete e as opções de pagamento serão definidos na próxima etapa.</small><button className="btn primary checkout-button" onClick={onCheckout}>Continuar para pagamento <ChevronRight size={17} /></button></div>
    </>}
  </section></div>;
}

function Checkout({ items, total, onBack, onClose }: { items: (CartItem & { product: Product })[]; total: number; onBack: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const maxInstallments = items.length ? Math.min(...items.map(({ product }) => Math.max(1, Math.min(12, product.maxInstallments ?? 1)))) : 1;
  async function pay() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method, items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      if (typeof data.paymentUrl !== 'string' || !data.paymentUrl.startsWith('https://')) throw new Error('Link de pagamento inválido.');
      window.location.assign(data.paymentUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao iniciar pagamento.'); setLoading(false); }
  }
  return <div className="modal-backdrop checkout-backdrop"><section className="checkout-modal" role="dialog" aria-modal="true" aria-label="Finalizar compra">
    <div className="cart-head"><div><span className="eyebrow">PAGAMENTO SEGURO</span><h2><CreditCard size={21} /> Finalizar compra</h2></div><button className="close" onClick={onClose}><X /></button></div>
    <div className="checkout-placeholder"><div className="checkout-icon"><CreditCard size={30} /></div><h3>Checkout PagBank</h3><p>Você será direcionado ao ambiente seguro do PagBank. O servidor verificará os preços e o estoque antes de criar o checkout. O valor final é confirmado no PagBank.</p><div className="checkout-summary"><b>Resumo estimado</b>{items.map(({ product, quantity }) => <div key={product.id}><span>{quantity}x {product.name}</span><strong>{money(product.price * quantity)}</strong></div>)}<div className="checkout-total"><span>Total estimado</span><strong>{money(total)}</strong></div></div><fieldset className="payment-choice"><legend>Escolha como pagar</legend><label><input type="radio" name="paymentMethod" checked={method === 'PIX'} onChange={() => setMethod('PIX')} /> Pix — à vista</label><label><input type="radio" name="paymentMethod" checked={method === 'CREDIT_CARD'} onChange={() => setMethod('CREDIT_CARD')} /> Cartão de crédito — até {maxInstallments}x</label><small>{method === 'CREDIT_CARD' ? 'O número de parcelas e os valores finais, incluindo eventuais juros, serão apresentados no PagBank.' : 'O Pix será gerado na página segura do PagBank.'}</small></fieldset><div className="checkout-safe"><CheckCircle2 size={16} /> O retorno à loja não comprova pagamento aprovado.</div>{error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}</div>
    <div className="checkout-actions"><button className="btn secondary" disabled={loading} onClick={onBack}><ArrowLeft size={16} /> Voltar ao carrinho</button><button className="btn primary" disabled={loading || !items.length} onClick={pay}>{loading ? 'Preparando pagamento...' : method === 'PIX' ? 'Continuar com Pix' : 'Continuar com cartão'}</button></div>
  </section></div>;
}

function ProductModal({ product, onSave, onClose, saving }: { product: Product; onSave: (p: Product) => Promise<void>; onClose: () => void; saving: boolean }) {
  const [form, setForm] = useState(product);
  function image(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Selecione um arquivo de imagem.');
    if (file.size > 5 * 1024 * 1024) return alert('A imagem deve ter no máximo 5 MB.');
    const reader = new FileReader(); reader.onload = () => setForm(f => ({ ...f, image: String(reader.result) })); reader.readAsDataURL(file);
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal"><div className="modal-head"><div><span className="eyebrow">CATÁLOGO</span><h2>{product.name ? 'Editar produto' : 'Novo produto'}</h2></div><button className="close" onClick={onClose}><X /></button></div>
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label>Nome do produto<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Camiseta básica" /></label>
      <label>Descrição resumida<input value={form.shortDescription ?? ''} onChange={e => setForm({ ...form, shortDescription: e.target.value })} placeholder="Uma frase curta para o cartão do produto" /></label>
      <label>Descrição completa<textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalhes, características, benefícios, medidas..." /></label>
      <div className="form-row"><label>Preço (R$)<input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></label><label>Estoque<input type="number" min="0" step="1" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} /></label></div>
      <label>Máximo de parcelas no cartão<select value={form.maxInstallments ?? 1} onChange={e => setForm({ ...form, maxInstallments: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x</option>)}</select></label>
      <label><input type="checkbox" checked={form.active !== false} onChange={e=>setForm({...form,active:e.target.checked})} /> Produto ativo na loja</label>
      <label>Categoria<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Roupas, Acessórios..." /></label>
      <div className="upload-area"><div className="upload-preview">{form.image ? <img src={form.image} alt="Prévia do produto" /> : <ImagePlus size={30} />}</div><div><b>Foto do produto</b><p>JPG, PNG ou WEBP · até 5 MB</p><label className="upload-btn">Escolher imagem<input type="file" accept="image/*" onChange={image} /></label>{form.image && <button type="button" className="remove-image" onClick={() => setForm({ ...form, image: '' })}>Remover foto</button>}</div></div>
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</button></div>
    </form>
  </section></div>;
}
export default App;
