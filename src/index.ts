import express, { Application } from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import AuthRoutes from "./routes/authRoutes";
import SubscribeRoutes from "./routes/subscribeRoutes";
import DoctorRoutes from "./routes/doctorRoutes";
import PatientRoutes from "./routes/patientRoutes";
import { webHookController } from "./controllers/webhookController";

class Server {
    public app: Application;

    constructor() {
        this.app = express();
        this.config();
        this.routes();
    }

    config() : void {
        const corsOptions = {
            origin: 'http://localhost:4200', // Frontend
            credentials: true,
            optionsSuccessStatus: 200
        };

        this.app.set('port', process.env.PORT || 3000);
        this.app.use(morgan('dev'));
        this.app.use(cors(corsOptions));
        this.app.use("/api/sub/webhooks/stripe",
            express.raw({ type: "*/*" }),
            (req, res, next) => {
                if (!req.body || !Buffer.isBuffer(req.body)) {
                    return res.status(400).send("No se recibió raw body");
                }
                next();
            }
        );
        this.app.post("/api/sub/webhooks/stripe", webHookController.handleStripeWebhook);
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended : false}));
        this.app.use(cookieParser());
    }

    routes() : void {
        this.app.use("/api/auth", AuthRoutes);
        this.app.use("/api/sub", SubscribeRoutes);
        this.app.use("/api/doc", DoctorRoutes);
        this.app.use("/api/pat", PatientRoutes)
    }

    start(): void {
        this.app.listen(this.app.get('port'), () => {
            console.log('Server running on port', this.app.get('port'));
        });
    }
}

const server = new Server();
server.start();
