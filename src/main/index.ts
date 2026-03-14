import express from "express";
import bodyParser from "body-parser";
import UsersEndpoints from "../endpoints/users/UsersEndpoints";
import ShareEndpoints from "../endpoints/share/ShareEndpoints";
import RestaurantEndpoints from "../endpoints/restaurant/RestaurantEndpoints";
import DishesEndpoints from "../endpoints/dishes/DishesEndpoints";
import { initDotEnv } from "../Dotenv";
import cors from "cors";

import { DBConnection } from "../sql/DBConnection";
import MultiplayerEndpoints from "../endpoints/multiplayer/MultiplayerEndpoints";

initDotEnv();
DBConnection.initDBConnection();

const APP = express();

APP.use(cors());
APP.use(bodyParser.json());

const SERVER = APP.listen(2223, () => console.log("Started Server"));

const usersEndpoints = new UsersEndpoints(APP);
const shareEndpoints = new ShareEndpoints(APP);
const restaurantEndpoints = new RestaurantEndpoints(APP);
const dishesEndpoints = new DishesEndpoints(APP);
const multiplayerEndpoints = new MultiplayerEndpoints(APP, SERVER);