import express, { ErrorRequestHandler, NextFunction } from "express";
import UsersEndpoints from "../endpoints/users/UsersEndpoints";
import ShareEndpoints from "../endpoints/share/ShareEndpoints";
import RestaurantEndpoints from "../endpoints/restaurant/RestaurantEndpoints";
import DishesEndpoints from "../endpoints/dishes/DishesEndpoints";
import { initDotEnv } from "../Dotenv";
import Users from "../sql/Users";
import { DBConnection } from "../sql/DBConnection";

initDotEnv();
DBConnection.initDBConnection();

const SERVER = express();
SERVER.use(express.json());


const usersEndpoints = new UsersEndpoints(SERVER);
const shareEndpoints = new ShareEndpoints(SERVER);
const restaurantEndpoints = new RestaurantEndpoints(SERVER);
const dishesEndpoints = new DishesEndpoints(SERVER);

SERVER.listen(2223, () => console.log("Started Server"));