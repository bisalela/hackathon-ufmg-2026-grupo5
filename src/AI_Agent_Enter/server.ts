import express from "express"
import cors from "cors"
import routes from "./routes.js"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 3001)
const allowedOrigin = process.env.AGENT_FRONTEND_ORIGIN ?? process.env.FRONTEND_ORIGIN ?? "*"

app.use(cors({ origin: allowedOrigin }))
app.use(express.json())

app.use("/agent", routes)

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "AI Agent backend is running" })
})

app.listen(port, () => {
  console.log(`AI Agent backend listening on http://localhost:${port}`)
})
