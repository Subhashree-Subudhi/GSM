import { useEffect, useMemo, useState } from 'react'

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

function formatCurrency(value: number) {
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
}

function useFetch<T>(url: string) {
	const [data, setData] = useState<T | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
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

export default function App() {
	const { data: products, loading: productsLoading } = useFetch<Product[]>('/api/products')
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
	const { data: accessorySuggestions } = useFetch<{ productId: string; suggestions: Accessory[] }>(
		selectedProduct ? `/api/suggestions/${selectedProduct.id}` : ''
	)

	const [cart, setCart] = useState<CartItem[]>([])

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

	const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.quantity, 0), [cart])

	async function checkout() {
		const response = await fetch('/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items: cart }),
		})
		const data = await response.json()
		if (response.ok) {
			alert(`Order placed! Order ID: ${data.orderId}`)
			setCart([])
		} else {
			alert(data.error || 'Checkout failed')
		}
	}

	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b bg-white/80 backdrop-blur">
				<div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-brand-gold/20 border border-brand-gold flex items-center justify-center">
							<span className="font-bold text-brand-gold">G</span>
						</div>
						<div>
							<p className="text-xl font-semibold tracking-wide">GMS</p>
							<p className="text-xs text-slate-500 -mt-1">Classy • Affordable • Sarees & Sets</p>
						</div>
					</div>
					<div className="flex items-center gap-6">
						<div className="text-sm text-slate-600">Cart: <span className="font-semibold">{cart.length}</span></div>
						<button className="px-4 py-2 rounded-md bg-brand-gold text-white" onClick={checkout} disabled={cart.length === 0}>
							Checkout {cart.length > 0 && <span>({formatCurrency(cartTotal)})</span>}
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-8 flex-1 w-full">
				<section>
					<h2 className="text-2xl font-semibold mb-2">Discover Sarees</h2>
					<p className="text-slate-600 mb-6">Handpicked traditional styles for every occasion. Pair with curated accessories to complete your look.</p>

					{productsLoading && <div className="text-slate-500">Loading products...</div>}

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{products?.map(p => (
							<div key={p.id} className="border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition">
								<img src={p.imageUrl} alt={p.name} className="h-64 w-full object-cover" />
								<div className="p-4">
									<h3 className="font-semibold text-lg">{p.name}</h3>
									<p className="text-slate-600 line-clamp-2 mb-3">{p.description}</p>
									<div className="flex items-center justify-between">
										<span className="text-brand-gold font-semibold">{formatCurrency(p.price)}</span>
										<div className="flex gap-2">
											<button className="px-3 py-1.5 rounded-md border" onClick={() => addToCart({ id: p.id, type: 'product', name: p.name, price: p.price, imageUrl: p.imageUrl, quantity: 1 })}>Add</button>
											<button className="px-3 py-1.5 rounded-md bg-slate-900 text-white" onClick={() => setSelectedProduct(p)}>View</button>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="mt-10">
					<h2 className="text-2xl font-semibold mb-3">Cart</h2>
					{cart.length === 0 ? (
						<p className="text-slate-600">Your cart is empty.</p>
					) : (
						<div className="space-y-3">
							{cart.map(item => (
								<div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
									<div className="flex items-center gap-3">
										<img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded" />
										<div>
											<p className="font-medium">{item.name}</p>
											<p className="text-sm text-slate-600">{item.type} • Qty: {item.quantity}</p>
										</div>
									</div>
									<div className="flex items-center gap-4">
										<span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
										<button className="text-rose-600" onClick={() => removeFromCart(item.id)}>Remove</button>
									</div>
								</div>
							))}
							<div className="flex items-center justify-between border-t pt-3">
								<span className="font-semibold">Total</span>
								<span className="font-semibold">{formatCurrency(cartTotal)}</span>
							</div>
						</div>
					)}
				</section>
			</main>

			{selectedProduct && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
					<div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
						<div className="grid grid-cols-1 md:grid-cols-2">
							<img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-80 object-cover" />
							<div className="p-6">
								<h3 className="text-xl font-semibold">{selectedProduct.name}</h3>
								<p className="text-slate-600 mt-1">{selectedProduct.description}</p>
								<p className="text-brand-gold font-semibold mt-3">{formatCurrency(selectedProduct.price)}</p>
								<div className="mt-4">
									<h4 className="font-medium mb-2">Suggested Accessories</h4>
									<div className="grid grid-cols-2 gap-3">
										{accessorySuggestions?.suggestions?.map(a => (
											<div key={a.id} className="border rounded-lg overflow-hidden">
												<img src={a.imageUrl} alt={a.name} className="h-28 w-full object-cover" />
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
								</div>

								<div className="mt-6 flex items-center gap-3">
									<button className="px-4 py-2 rounded-md border" onClick={() => addToCart({ id: selectedProduct.id, type: 'product', name: selectedProduct.name, price: selectedProduct.price, imageUrl: selectedProduct.imageUrl, quantity: 1 })}>Add Saree</button>
									<button className="px-4 py-2 rounded-md bg-brand-gold text-white" onClick={() => {
										// add all accessories + product as a combo
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

			<footer className="border-t py-6 text-center text-sm text-slate-600">© {new Date().getFullYear()} GMS — Classy looks at real prices.</footer>
		</div>
	)
}
