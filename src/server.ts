import app from "./app.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`Marches running at http://localhost:${PORT}`);
});
