import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

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
