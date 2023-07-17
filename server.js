const express = require('express');
const cors = require('cors');
const session = require('express-session');
const userRoutes = require('./routes/userfunctionality');
const adminRoutes = require('./routes/adminfunctionality')
const path = require("path"); 
const redis = require('./utils/redisclient');
const redisClient = redis.getClient();

const PORT = process.env.PORT || 8080;

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(cors());
app.use(express.json());

// Session middleware setup
app.use(session({
  secret: 'myApp-Secret-Key', // Replace with your own secret key
  resave: false,
  saveUninitialized: true
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/', userRoutes);
app.use('/', adminRoutes);

app.get('/home',async(req,res)=>{
  res.sendFile(path.join(__dirname,'./public/homePage.html'));
});

app.listen(PORT, async (error) => {
  if (!error) {
    const locationscount = await redisClient.get('myApp:locationscount');
    console.log(locationscount);
    if(!locationscount){
      await redisClient.set('myApp:locationscount',1);
    }
    await redis.createIndexes();
    console.log("Server is successfully running on port: " + PORT);
  } else {
    console.log("Error Occurred (SERVER CANT START): ", error);
  }
});