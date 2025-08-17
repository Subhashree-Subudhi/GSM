import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import Stripe from "stripe";

export interface Product {
	id: string;
	name: string;
	description: string;
	price: number;
	imageUrl: string;
	category: string;
	colors: string[];
	styles: string[];
	inStock: boolean;
}

export interface Accessory {
	id: string;
	name: string;
	type: string;
	price: number;
	imageUrl: string;
	colors: string[];
	styles: string[];
	inStock: boolean;
}

const app = express();
app.use(cors());
app.use(express.json());

function readJsonFile<T>(relativePathFromDist: string): T {
	const absolutePath = path.join(__dirname, relativePathFromDist);
	const data = fs.readFileSync(absolutePath, "utf-8");
	return JSON.parse(data) as T;
}

const products: Product[] = readJsonFile<Product[]>("../data/products.json");
const accessories: Accessory[] = readJsonFile<Accessory[]>("../data/accessories.json");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

app.get("/api/health", (_req, res) => {
	res.json({ ok: true, service: "GMS API", timestamp: Date.now() });
});

app.get("/api/products", (_req, res) => {
	res.json(products);
});

app.get("/api/products/:id", (req, res) => {
	const product = products.find(p => p.id === req.params.id);
	if (!product) return res.status(404).json({ error: "Product not found" });
	res.json(product);
});

app.get("/api/accessories", (_req, res) => {
	res.json(accessories);
});

app.get("/api/suggestions/:productId", (req, res) => {
	const { productId } = req.params;
	const product = products.find(p => p.id === productId);
	if (!product) return res.status(404).json({ error: "Product not found" });

	const suggestions = accessories.filter(a => {
		const styleMatch = a.styles.some(s => product.styles.includes(s));
		const colorMatch = a.colors.some(c => product.colors.includes(c));
		return styleMatch || colorMatch;
	});
	res.json({ productId, suggestions });
});

app.post("/api/checkout", (req, res) => {
	const { items } = req.body ?? {};
	if (!Array.isArray(items) || items.length === 0) {
		return res.status(400).json({ error: "No items to checkout" });
	}
	const orderId = Math.random().toString(36).slice(2);
	res.json({ ok: true, orderId, items });
});

app.post("/api/create-checkout-session", async (req, res) => {
	try {
		const { items } = req.body ?? {} as { items: Array<{ id: string; name: string; price: number; quantity: number; imageUrl?: string; type?: string }>; };
		if (!Array.isArray(items) || items.length === 0) {
			return res.status(400).json({ error: "No items to checkout" });
		}

		const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
		const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0] || req.get("host");
		const origin = `${proto}://${host}`;

		if (!stripe) {
			// Fallback: mock checkout when Stripe is not configured
			return res.status(200).json({
				mock: true,
				message: "Stripe not configured. Proceeding with mock checkout.",
				url: `${origin}/?success=true`,
			});
		}

		const line_items = items.map((it) => ({
			quantity: Math.max(1, Number(it.quantity || 1)),
			price_data: {
				currency: "inr",
				unit_amount: Math.round(Number(it.price) * 100),
				product_data: {
					name: it.name,
					images: it.imageUrl ? [it.imageUrl] : [],
					metadata: { id: it.id, type: it.type || "unknown" }
				}
			}
		}));

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			payment_method_types: ["card"],
			line_items,
			success_url: `${origin}/?success=true`,
			cancel_url: `${origin}/?canceled=true`,
			shipping_address_collection: { allowed_countries: ["IN"] },
		});

		return res.json({ url: session.url });
	} catch (err: any) {
		console.error("Checkout session error", err);
		return res.status(500).json({ error: "Failed to create checkout session" });
	}
});

// Serve built client if present (mount at root, exclude /api/*)
const clientDist = path.resolve(__dirname, "../../client/dist");
console.log("[GMS] clientDist:", clientDist, "exists:", fs.existsSync(clientDist));
if (fs.existsSync(clientDist)) {
	app.use(express.static(clientDist));
	app.get("/", (_req, res) => {
		res.sendFile(path.join(clientDist, "index.html"));
	});
	app.get(/^(?!\/api\/).*/, (_req, res) => {
		res.sendFile(path.join(clientDist, "index.html"));
	});
}

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
	console.log(`GMS API listening on http://localhost:${port}`);
});
