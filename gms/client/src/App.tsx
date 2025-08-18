import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Link, useParams } from 'react-router-dom'

type Product = {
	id: string
	name: string
	description: string
	price: number
	imageUrl: string
	category: string
	colors: string[]
	styles: string[]
	inStock: boolean
}

type Accessory = {
	id: string
	name: string
	type: string
	price: number
	imageUrl: string
	colors: string[]
	styles: string[]
	inStock: boolean
}

type CartItem = {
	id: string
	type: 'product' | 'accessory'
	name: string
	price: number
	imageUrl: string
	quantity: number
}

declare global {
	interface Window { cloudinary?: any; Razorpay?: any }
}

function withCdn(url: string, fallbackSeed: string) {
	const CLOUD = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD as string | undefined
	if (CLOUD && url) {
		try {
			const encoded = encodeURIComponent(url)
			return `https://res.cloudinary.com/${CLOUD}/image/fetch/f_auto,q_auto/${encoded}`
		} catch {}
	}
	return url || `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/600/800`
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
}

function useFetch<T>(url: string) {
	const [data, setData] = useState<T | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!url) return
		setLoading(true)
		fetch(url)
			.then(async r => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`)
				return r.json()
			})
			.then(setData)
			.catch(e => setError(String(e)))
			.finally(() => setLoading(false))
	}, [url])

	return { data, loading, error }
}

function stableNumberFromString(input: string) {
	let hash = 0
	for (let i = 0; i < input.length; i++) {
		hash = (hash << 5) - hash + input.charCodeAt(i)
		hash |= 0
	}
	return Math.abs(hash)
}

async function loadRazorpayScript() {
	if (window.Razorpay) return true
	return new Promise<boolean>((resolve) => {
		const s = document.createElement('script')
		s.src = 'https://checkout.razorpay.com/v1/checkout.js'
		s.onload = () => resolve(true)
		s.onerror = () => resolve(false)
		document.body.appendChild(s)
	})
}

export default function App() {
	const { data: products, loading: productsLoading } = useFetch<Product[]>('/api/products')
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
	const { data: accessorySuggestions } = useFetch<{ productId: string; suggestions: Accessory[] }>(
		selectedProduct ? `/api/suggestions/${selectedProduct.id}` : ''
	)

	const [cart, setCart] = useState<CartItem[]>([])
	const [wishlist, setWishlist] = useState<Record<string, boolean>>(() => {
		try { return JSON.parse(localStorage.getItem('gms_wishlist') || '{}') } catch { return {} }
	})

	useEffect(() => {
		localStorage.setItem('gms_wishlist', JSON.stringify(wishlist))
	}, [wishlist])

	const [query, setQuery] = useState('')
	const [activeStyle, setActiveStyle] = useState<string>('all')
	const [sort, setSort] = useState<'relevance' | 'price-asc' | 'price-desc'>('relevance')

	function addToCart(item: CartItem) {
		setCart(prev => {
			const idx = prev.findIndex(p => p.id === item.id)
			if (idx >= 0) {
				const copy = [...prev]
				copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + item.quantity }
				return copy
			}
			return [...prev, item]
		})
	}

	function removeFromCart(id: string) {
		setCart(prev => prev.filter(p => p.id !== id))
	}

	function toggleWishlist(id: string) {
		setWishlist(prev => ({ ...prev, [id]: !prev[id] }))
	}

	const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.quantity, 0), [cart])

	async function startCheckout(items: CartItem[]) {
		// Try Razorpay first
		try {
			const rpRes = await fetch('/api/razorpay/order', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items })
			})
			const rp = await rpRes.json()
			if (rpRes.ok && rp?.order?.id && rp?.keyId) {
				const ok = await loadRazorpayScript()
				if (ok && window.Razorpay) {
					const rzp = new window.Razorpay({
						key: rp.keyId,
						amount: rp.order.amount,
						currency: rp.order.currency,
						name: 'GMS',
						description: 'GMS Order',
						order_id: rp.order.id,
						prefill: {},
						notes: {},
						theme: { color: '#0f172a' },
						handler: () => { window.location.href = '/?success=true' },
						modal: { ondismiss: () => { window.location.href = '/?canceled=true' } }
					})
					rzp.open()
					return
				}
			}
		} catch {}

		// Fallback to Stripe
		const response = await fetch('/api/create-checkout-session', {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items })
		})
		const data = await response.json()
		if (response.ok && data?.url) {
			window.location.href = data.url
			return
		}
		// Fallback to mock checkout
		const mock = await fetch('/api/checkout', {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items })
		})
		const mockData = await mock.json()
		if (mock.ok) {
			window.location.href = '/?success=true'
		} else {
			alert(mockData.error || 'Checkout failed')
		}
	}

	async function checkout() { await startCheckout(cart) }

	const urlParams = new URLSearchParams(window.location.search)
	const isSuccess = urlParams.get('success') === 'true'
	const isCanceled = urlParams.get('canceled') === 'true'

	const allStyles = useMemo(() => Array.from(new Set((products ?? []).flatMap(p => p.styles))).sort(), [products])

	const filteredSortedProducts = useMemo(() => {
		let list = (products ?? [])
		if (query.trim()) {
			const q = query.trim().toLowerCase()
			list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
		}
		if (activeStyle !== 'all') list = list.filter(p => p.styles.includes(activeStyle))
		if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
		if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
		return list
	}, [products, query, activeStyle, sort])

	return (
		<div className="min-h-screen flex flex-col">
			{isSuccess && (<div className="bg-green-50 border-b border-green-200 text-green-800 text-sm text-center py-2">Payment successful! Thank you for your order.</div>)}
			{isCanceled && (<div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-sm text-center py-2">Payment canceled. Your cart is still available.</div>)}

			<header className="border-b bg-white/80 backdrop-blur sticky top-0 z-40">
				<div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
					<Link to="/" className="flex items-center gap-2 mr-2">
						<div className="h-9 w-9 rounded-full bg-brand-gold/20 border border-brand-gold flex items-center justify-center"><span className="font-bold text-brand-gold">G</span></div>
						<p className="text-lg font-semibold tracking-wide">GMS</p>
					</Link>
					<div className="flex-1">
						<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sarees (e.g., banarasi, organza, wedding)" className="w-full rounded-full border px-4 py-2 text-sm" />
					</div>
					<div className="flex items-center gap-3">
						<div className="text-sm text-slate-600">Cart: <span className="font-semibold">{cart.length}</span></div>
						<button className="px-4 py-2 rounded-md bg-brand-gold text-white" onClick={checkout} disabled={cart.length === 0}>Checkout {cart.length > 0 && <span>({formatCurrency(cartTotal)})</span>}</button>
					</div>
				</div>
				<nav className="mx-auto max-w-7xl px-4 py-2 text-sm text-slate-700 flex gap-4">
					<Link to="/category/traditional" className="hover:text-slate-900">Traditional</Link>
					<Link to="/category/wedding" className="hover:text-slate-900">Wedding</Link>
					<Link to="/category/designer" className="hover:text-slate-900">Designer</Link>
					<Link to="/category/handloom" className="hover:text-slate-900">Handloom</Link>
				</nav>
			</header>

			<section className="relative">
				<div className="h-56 md:h-72 w-full bg-gradient-to-r from-rose-50 via-amber-50 to-teal-50 flex items-center" style={{ backgroundImage: 'url(https://source.unsplash.com/1600x500/?saree,bridal,fashion)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
					<div className="backdrop-blur-sm bg-white/50 w-full">
						<div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
							<h1 className="text-2xl md:text-3xl font-bold">Classy Sarees. Honest Prices.</h1>
							<p className="text-slate-700 mt-2 max-w-2xl">Curated Banarasi, Kanjivaram, Organza, Cotton and more. Build your outfit with matching accessories in one click.</p>
							<div className="mt-4 flex gap-3">
								<button onClick={() => setActiveStyle('wedding')} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm">Shop Wedding Picks</button>
								<button onClick={() => setActiveStyle('traditional')} className="px-4 py-2 rounded-md border text-sm">Explore Classics</button>
							</div>
						</div>
					</div>
				</div>
			</section>

			<Routes>
				<Route path="/" element={
					<HomePage
						productsLoading={productsLoading}
						allStyles={allStyles}
						activeStyle={activeStyle}
						setActiveStyle={setActiveStyle}
						sort={sort}
						setSort={setSort}
						filteredSortedProducts={filteredSortedProducts}
						addToCart={addToCart}
						setSelectedProduct={setSelectedProduct}
						startCheckout={startCheckout}
						cart={cart}
						cartTotal={cartTotal}
						removeFromCart={removeFromCart}
						checkout={checkout}
					/>
				} />
				<Route path="/category/:style" element={<CategoryPage products={products ?? []} setSelectedProduct={setSelectedProduct} addToCart={addToCart} startCheckout={startCheckout} wishlist={wishlist} toggleWishlist={toggleWishlist} />} />
			</Routes>

			{selectedProduct && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
					<div className="bg-white rounded-xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
						<div className="grid grid-cols-1 md:grid-cols-2">
							<img src={withCdn(selectedProduct.imageUrl, selectedProduct.id)} alt={selectedProduct.name} className="w-full h-96 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(selectedProduct.id)}/600/800` }} />
							<div className="p-6">
								<h3 className="text-xl font-semibold">{selectedProduct.name}</h3>
								<p className="text-slate-600 mt-1">{selectedProduct.description}</p>
								<p className="text-brand-gold font-semibold mt-3">{formatCurrency(selectedProduct.price)}</p>
								<div className="mt-4">
									<h4 className="font-medium mb-2">Suggested Accessories</h4>
									<div className="grid grid-cols-2 gap-3">
										{accessorySuggestions?.suggestions?.map(a => (
											<div key={a.id} className="border rounded-lg overflow-hidden">
												<img src={withCdn(a.imageUrl, a.id)} alt={a.name} className="h-28 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(a.id)}/400/400` }} />
												<div className="p-2">
													<p className="text-sm font-medium">{a.name}</p>
													<p className="text-xs text-slate-600">{a.type}</p>
													<div className="flex items-center justify-between mt-1">
														<span className="text-sm font-semibold">{formatCurrency(a.price)}</span>
														<button className="text-xs px-2 py-1 rounded bg-slate-900 text-white" onClick={() => addToCart({ id: a.id, type: 'accessory', name: a.name, price: a.price, imageUrl: a.imageUrl, quantity: 1 })}>Add</button>
													</div>
												</div>
											</div>
										))}
									</div>

								<div className="mt-6 flex items-center gap-3">
									<button className="px-4 py-2 rounded-md border" onClick={() => addToCart({ id: selectedProduct.id, type: 'product', name: selectedProduct.name, price: selectedProduct.price, imageUrl: selectedProduct.imageUrl, quantity: 1 })}>Add Saree</button>
									<button className="px-4 py-2 rounded-md bg-brand-gold text-white" onClick={() => {
										addToCart({ id: selectedProduct.id, type: 'product', name: selectedProduct.name, price: selectedProduct.price, imageUrl: selectedProduct.imageUrl, quantity: 1 })
										accessorySuggestions?.suggestions?.forEach(a => addToCart({ id: a.id, type: 'accessory', name: a.name, price: a.price, imageUrl: a.imageUrl, quantity: 1 }))
										setSelectedProduct(null)
									}}>Add Combo</button>
									<button className="px-4 py-2 rounded-md" onClick={() => setSelectedProduct(null)}>Close</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			<footer className="border-t py-6 text-center text-xs md:text-sm text-slate-600">© {new Date().getFullYear()} GMS — Classy looks at real prices.</footer>
		</div>
	)
}

function HomePage({ productsLoading, allStyles, activeStyle, setActiveStyle, sort, setSort, filteredSortedProducts, addToCart, setSelectedProduct, startCheckout, cart, cartTotal, removeFromCart, checkout }:{
	productsLoading: boolean;
	allStyles: string[];
	activeStyle: string;
	setActiveStyle: (s: string)=>void;
	sort: 'relevance' | 'price-asc' | 'price-desc';
	setSort: (s: any)=>void;
	filteredSortedProducts: Product[];
	addToCart: (i: CartItem)=>void;
	setSelectedProduct: (p: Product)=>void;
	startCheckout: (items: CartItem[])=>void;
	cart: CartItem[];
	cartTotal: number;
	removeFromCart: (id: string)=>void;
	checkout: ()=>void;
}) {
	return (
		<main className="mx-auto max-w-7xl px-4 py-6 md:py-8 flex-1 w-full">
			<div className="flex items-center justify-between flex-wrap gap-3 mb-4">
				<div className="flex gap-2 overflow-x-auto no-scrollbar">
					<button onClick={() => setActiveStyle('all')} className={`px-3 py-1.5 rounded-full border text-sm ${activeStyle === 'all' ? 'bg-slate-900 text-white' : ''}`}>All</button>
					{allStyles.map(s => (
						<button key={s} onClick={() => setActiveStyle(s)} className={`px-3 py-1.5 rounded-full border text-sm capitalize ${activeStyle === s ? 'bg-slate-900 text-white' : ''}`}>{s}</button>
					))}
				</div>
				<div className="flex items-center gap-2 text-sm">
					<label className="text-slate-600">Sort</label>
					<select value={sort} onChange={(e) => setSort(e.target.value as any)} className="border rounded-md px-2 py-1">
						<option value="relevance">Relevance</option>
						<option value="price-asc">Price: Low to High</option>
						<option value="price-desc">Price: High to Low</option>
					</select>
				</div>
			</div>

			<section>
				<h2 className="text-lg font-semibold mb-3">Discover Sarees</h2>
				{productsLoading && <div className="text-slate-500">Loading products...</div>}

				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
					{filteredSortedProducts?.map(p => {
						const seed = stableNumberFromString(p.id)
						const rating = (seed % 15) / 2 + 3
						const clampedRating = Math.min(5, Math.max(3, Math.round(rating * 10) / 10))
						const discount = (seed % 30) + 10
						const mrp = Math.round(p.price / (1 - discount / 100))
						const fallback = `https://picsum.photos/seed/${encodeURIComponent(p.id)}/600/800`
						return (
							<div key={p.id} className="group border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition flex flex-col">
								<div className="relative">
									<img src={withCdn(p.imageUrl, p.id)} alt={p.name} className="h-64 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback }} />
									<div className="absolute top-2 left-2 text-xs bg-rose-600 text-white px-2 py-1 rounded">{discount}% OFF</div>
									<button aria-label="wishlist" onClick={() => {/* wishlist handled at App level via modal */}} className="hidden" />
								</div>
								<div className="p-3 flex-1 flex flex-col">
									<h3 className="font-medium text-sm md:text-base line-clamp-2">{p.name}</h3>
									<p className="text-xs text-slate-600 line-clamp-2 mt-1">{p.description}</p>
									<div className="flex items-center gap-2 mt-2">
										<span className="font-semibold text-brand-gold">{formatCurrency(p.price)}</span>
										<span className="text-xs line-through text-slate-500">{formatCurrency(mrp)}</span>
									</div>
									<div className="text-xs text-amber-600 mt-1">★ {clampedRating}</div>
									<div className="mt-3 flex items-center gap-2 mt-auto">
										<button className="px-3 py-1.5 rounded-md border text-xs" onClick={() => addToCart({ id: p.id, type: 'product', name: p.name, price: p.price, imageUrl: p.imageUrl, quantity: 1 })}>Add to Cart</button>
										<button className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs" onClick={() => setSelectedProduct(p)}>View</button>
										<button className="px-3 py-1.5 rounded-md bg-brand-gold text-white text-xs" onClick={() => startCheckout([{ id: p.id, type: 'product', name: p.name, price: p.price, imageUrl: p.imageUrl, quantity: 1 }])}>Buy Now</button>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</section>

			<section className="mt-10">
				<h2 className="text-lg font-semibold mb-3">Cart</h2>
				{cart.length === 0 ? (
					<p className="text-slate-600 text-sm">Your cart is empty.</p>
				) : (
					<div className="space-y-3">
						{cart.map(item => (
							<div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
								<div className="flex items-center gap-3">
									<img src={withCdn(item.imageUrl, item.id)} alt={item.name} className="w-16 h-16 object-cover rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(item.id)}/128/128` }} />
									<div>
										<p className="font-medium text-sm">{item.name}</p>
										<p className="text-xs text-slate-600">{item.type} • Qty: {item.quantity}</p>
									</div>
								</div>
								<div className="flex items-center gap-4">
									<span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
									<button className="text-rose-600 text-sm" onClick={() => removeFromCart(item.id)}>Remove</button>
								</div>
							</div>
						))}
						<div className="flex items-center justify-between border-t pt-3">
							<span className="font-semibold">Total</span>
							<span className="font-semibold">{formatCurrency(cartTotal)}</span>
						</div>
						<div className="text-right">
							<button className="mt-2 px-4 py-2 rounded-md bg-brand-gold text-white" onClick={checkout}>Checkout</button>
						</div>
					</div>
				)}
			</section>
		</main>
	)
}

function CategoryPage({ products, setSelectedProduct, addToCart, startCheckout, wishlist, toggleWishlist }:{ products: Product[]; setSelectedProduct: (p: Product)=>void; addToCart: (i: CartItem)=>void; startCheckout: (items: CartItem[])=>void; wishlist: Record<string, boolean>; toggleWishlist:(id:string)=>void }) {
	const { style } = useParams()
	const filtered = products.filter(p => p.styles.includes(style || ''))
	return (
		<main className="mx-auto max-w-7xl px-4 py-6 md:py-8 flex-1 w-full">
			<h2 className="text-lg font-semibold mb-3 capitalize">{style} Sarees</h2>
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
				{filtered.map(p => (
					<div key={p.id} className="group border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition flex flex-col">
						<div className="relative">
							<img src={withCdn(p.imageUrl, p.id)} alt={p.name} className="h-64 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(p.id)}/600/800` }} />
							<button aria-label="wishlist" onClick={() => toggleWishlist(p.id)} className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow">
								<span className={`inline-block w-5 h-5 ${wishlist[p.id] ? 'text-rose-600' : 'text-slate-400'}`}>❤</span>
							</button>
						</div>
						<div className="p-3 flex-1 flex flex-col">
							<h3 className="font-medium text-sm md:text-base line-clamp-2">{p.name}</h3>
							<div className="mt-3 flex items-center gap-2 mt-auto">
								<button className="px-3 py-1.5 rounded-md border text-xs" onClick={() => addToCart({ id: p.id, type: 'product', name: p.name, price: p.price, imageUrl: p.imageUrl, quantity: 1 })}>Add to Cart</button>
								<button className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs" onClick={() => setSelectedProduct(p)}>View</button>
								<button className="px-3 py-1.5 rounded-md bg-brand-gold text-white text-xs" onClick={() => startCheckout([{ id: p.id, type: 'product', name: p.name, price: p.price, imageUrl: p.imageUrl, quantity: 1 }])}>Buy Now</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</main>
	)
}
