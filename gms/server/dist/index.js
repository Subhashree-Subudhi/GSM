"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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