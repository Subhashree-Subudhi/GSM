"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const stripe_1 = __importDefault(require("stripe"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
function readJsonFile(relativePathFromDist) {
    const absolutePath = path_1.default.join(__dirname, relativePathFromDist);
    const data = fs_1.default.readFileSync(absolutePath, "utf-8");
    return JSON.parse(data);
}
const products = readJsonFile("../data/products.json");
const accessories = readJsonFile("../data/accessories.json");
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new stripe_1.default(stripeSecretKey) : null;
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "GMS API", timestamp: Date.now() });
});
app.get("/api/products", (_req, res) => {
    res.json(products);
});
app.get("/api/products/:id", (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product)
        return res.status(404).json({ error: "Product not found" });
    res.json(product);
});
app.get("/api/accessories", (_req, res) => {
    res.json(accessories);
});
app.get("/api/suggestions/:productId", (req, res) => {
    const { productId } = req.params;
    const product = products.find(p => p.id === productId);
    if (!product)
        return res.status(404).json({ error: "Product not found" });
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
        const { items } = req.body ?? {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "No items to checkout" });
        }
        const proto = req.headers["x-forwarded-proto"]?.split(",")[0] || req.protocol;
        const host = req.headers["x-forwarded-host"]?.split(",")[0] || req.get("host");
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
    }
    catch (err) {
        console.error("Checkout session error", err);
        return res.status(500).json({ error: "Failed to create checkout session" });
    }
});
// Serve built client if present (mount at root, exclude /api/*)
const clientDist = path_1.default.resolve(__dirname, "../../client/dist");
console.log("[GMS] clientDist:", clientDist, "exists:", fs_1.default.existsSync(clientDist));
if (fs_1.default.existsSync(clientDist)) {
    app.use(express_1.default.static(clientDist));
    app.get("/", (_req, res) => {
        res.sendFile(path_1.default.join(clientDist, "index.html"));
    });
    app.get(/^(?!\/api\/).*/, (_req, res) => {
        res.sendFile(path_1.default.join(clientDist, "index.html"));
    });
}
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
    console.log(`GMS API listening on http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map