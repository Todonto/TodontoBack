import express, { Application } from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import AuthRoutes from "./routes/authRoute"

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
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended : false}));
        this.app.use(cookieParser());
    }

    routes() : void {
        this.app.use("/api/auth", AuthRoutes);
    }

    start(): void {
        this.app.listen(this.app.get('port'), () => {
            console.log('Server running on port', this.app.get('port'));
        });
    }
}

const server = new Server();
server.start();
