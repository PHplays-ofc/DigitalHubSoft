import { useEffect, useMemo, useState } from 'react';
import {
  Package, Search, Plus, Pencil, Trash2, Download, Store, LayoutDashboard,
  ArrowLeft, ImagePlus, X, ExternalLink, ShoppingCart, Minus, Plus as PlusIcon,
  Trash, ShoppingBag, CreditCard, CheckCircle2, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

type Product = {
  id: string;
  name: string;
  shortDescription?: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
};
type CartItem = { productId: string; quantity: number };

const KEY = 'minha-loja-produtos-v1';
const CART_KEY = 'minha-loja-carrinho-v1';
const initial: Product[] = [
  { id: 'p1', name: 'Produto em destaque', shortDescription: 'Adicione uma frase curta para apresentar o produto.', description: 'Adicione uma descrição completa com características, benefícios, materiais, medidas e outras informações importantes para ajudar o cliente a decidir.', price: 49.90, category: 'Destaques', image: '', stock: 12 },
  { id: 'p2', name: 'Novidade da loja', shortDescription: 'Uma novidade para conhecer.', description: 'Use o painel administrativo para substituir este exemplo pelos seus produtos reais e preencher todos os detalhes.', price: 79.90, category: 'Novidades', image: '', stock: 8 },
  { id: 'p3', name: 'Mais vendido', shortDescription: 'Um dos favoritos da loja.', description: 'Inclua fotos, preço, categoria, quantidade disponível e uma descrição detalhada.', price: 29.90, category: 'Mais vendidos', image: '', stock: 20 }
];
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function readStorage<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

function App() {
  const [products, setProducts] = useState<Product[]>(() => readStorage(KEY, initial));
  const [cart, setCart] = useState<CartItem[]>(() => readStorage(CART_KEY, []));
  const [admin, setAdmin] = useState(location.hash === '#admin');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [editing, setEditing] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    const sync = () => { setAdmin(location.hash === '#admin'); if (location.hash === '#admin') { setCheckout(false); setCartOpen(false); setSelected(null); } };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))], [products]);
  const visible = products.filter(p => (category === 'Todas' || p.category === category) &&
    (`${p.name} ${p.shortDescription ?? ''} ${p.description} ${p.category}`).toLowerCase().includes(query.toLowerCase()));
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartDetails = cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) }))
    .filter((item): item is CartItem & { product: Product } => Boolean(item.product));
  const cartTotal = cartDetails.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function save(p: Product) {
    setProducts(old => old.some(x => x.id === p.id) ? old.map(x => x.id === p.id ? p : x) : [p, ...old]);
    setEditing(null); setNotice('Produto salvo com sucesso.'); window.setTimeout(() => setNotice(''), 2500);
  }
  function remove(id: string) {
    if (confirm('Tem certeza que deseja remover este produto?')) {
      setProducts(old => old.filter(p => p.id !== id));
      setCart(old => old.filter(item => item.productId !== id));
    }
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
  function exportExcel() {
    const rows = products.map(p => ({ 'Produto': p.name, 'Descrição curta': p.shortDescription ?? '', 'Descrição completa': p.description, 'Preço (R$)': p.price, 'Categoria': p.category, 'Estoque': p.stock, 'Imagem cadastrada': p.image ? 'Sim' : 'Não' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 60 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Produtos'); XLSX.writeFile(wb, 'catalogo-da-loja.xlsx');
  }

  return <div className="app">
    {admin ? <>
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-icon"><Store size={21} /></span><span>Minha Loja <small>PAINEL ADMINISTRATIVO</small></span></a>
        <a className="back-link" href="#"><ArrowLeft size={17} /> Ver loja</a>
      </header>
      <main className="admin-wrap">
        <div className="page-heading"><div><span className="eyebrow">GERENCIAMENTO</span><h1>Painel de produtos</h1><p>Cadastre, atualize e organize os itens exibidos na sua loja.</p></div><button className="btn secondary" onClick={exportExcel}><Download size={17} /> Exportar Excel</button></div>
        <div className="stats"><div className="stat"><Package /><span>Produtos cadastrados</span><strong>{products.length}</strong></div><div className="stat"><LayoutDashboard /><span>Categorias</span><strong>{categories.length - 1}</strong></div><div className="stat"><Download /><span>Planilha</span><strong>XLSX</strong></div></div>
        <section className="panel">
          <div className="panel-head"><div><h2>Seus produtos</h2><p>As alterações aparecem automaticamente na página da loja.</p></div><button className="btn primary" onClick={() => setEditing({ id: crypto.randomUUID(), name: '', shortDescription: '', description: '', price: 0, category: 'Geral', image: '', stock: 0 })}><Plus size={18} /> Adicionar produto</button></div>
          {notice && <div className="notice">{notice}</div>}
          <div className="table-scroll"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>
            {products.map(p => <tr key={p.id}><td><div className="product-cell">{p.image ? <img src={p.image} alt="" /> : <div className="mini-placeholder"><Package /></div>}<div><b>{p.name || 'Sem nome'}</b><small>{(p.shortDescription || p.description).slice(0, 55)}</small></div></div></td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.stock}</td><td><div className="actions"><button title="Editar" onClick={() => setEditing({ ...p })}><Pencil size={17} /></button><button title="Remover" className="danger" onClick={() => remove(p.id)}><Trash2 size={17} /></button></div></td></tr>)}
          </tbody></table>{!products.length && <div className="empty">Nenhum produto cadastrado. Clique em “Adicionar produto” para começar.</div>}</div>
        </section>
        <p className="privacy-note">Os dados ficam salvos neste navegador. Faça exportações periódicas como cópia de segurança.</p>
      </main>
      {editing && <ProductModal product={editing} onSave={save} onClose={() => setEditing(null)} />}
    </> : <>
      <header className="hero">
        <nav className="nav">
          <a className="brand light" href="#"><span className="brand-icon"><Store size={21} /></span><span>Minha Loja<small>SEU CATÁLOGO ONLINE</small></span></a>
          <div className="nav-actions"><button className="cart-trigger" onClick={() => setCartOpen(true)}><ShoppingCart size={18} /><span>Carrinho</span><b>{cartCount}</b></button><a className="admin-link" href="#admin">Área administrativa <ExternalLink size={15} /></a></div>
        </nav>
        <div className="hero-content"><span className="eyebrow light-text">BEM-VINDO(A) À NOSSA LOJA</span><h1>Encontre o que você<br /><em>está procurando.</em></h1><p>Conheça nossos produtos e escolha seu próximo favorito.</p><a className="hero-cta" href="#catalogo">Ver produtos <ArrowLeft size={17} /></a></div>
        <div className="hero-orb orb1" /><div className="hero-orb orb2" />
      </header>
      <main className="store-wrap" id="catalogo">
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
      {checkout && <Checkout items={cartDetails} total={cartTotal} onBack={() => setCheckout(false)} onClose={() => setCheckout(false)} />}
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
  return <div className="modal-backdrop checkout-backdrop"><section className="checkout-modal" role="dialog" aria-modal="true" aria-label="Finalizar compra">
    <div className="cart-head"><div><span className="eyebrow">ETAPA SEGUINTE</span><h2><CreditCard size={21} /> Finalizar compra</h2></div><button className="close" onClick={onClose}><X /></button></div>
    <div className="checkout-placeholder"><div className="checkout-icon"><CreditCard size={30} /></div><h3>Área de pagamento</h3><p>Esta etapa está preparada para receber a integração de pagamento. Ainda não há cobrança, pedido ou transação sendo realizada.</p><div className="checkout-summary"><b>Resumo do pedido</b>{items.map(({ product, quantity }) => <div key={product.id}><span>{quantity}x {product.name}</span><strong>{money(product.price * quantity)}</strong></div>)}<div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div></div><div className="checkout-safe"><CheckCircle2 size={16} /> Nenhum pagamento será solicitado nesta versão.</div></div>
    <div className="checkout-actions"><button className="btn secondary" onClick={onBack}><ArrowLeft size={16} /> Voltar ao carrinho</button><button className="btn primary" onClick={onClose}>Fechar</button></div>
  </section></div>;
}

function ProductModal({ product, onSave, onClose }: { product: Product; onSave: (p: Product) => void; onClose: () => void }) {
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
      <label>Categoria<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Roupas, Acessórios..." /></label>
      <div className="upload-area"><div className="upload-preview">{form.image ? <img src={form.image} alt="Prévia do produto" /> : <ImagePlus size={30} />}</div><div><b>Foto do produto</b><p>JPG, PNG ou WEBP · até 5 MB</p><label className="upload-btn">Escolher imagem<input type="file" accept="image/*" onChange={image} /></label>{form.image && <button type="button" className="remove-image" onClick={() => setForm({ ...form, image: '' })}>Remover foto</button>}</div></div>
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit">Salvar produto</button></div>
    </form>
  </section></div>;
}
export default App;
