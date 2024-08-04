const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { request } = require("http");
const app = express();
app.use(express.json())
app.use(cors())
const dbPath = path.join(__dirname, "database.db");

require('dotenv').config()

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    app.listen(3030, () => {
      console.log(`Server Running at http://localhost:3030`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    }
  };

  app.get("/seatsno/:train_id", async(request, response)=>{
    const { train_id } = request.params;
    console.log(train_id)
    const query1 = `select seat_capacity from train_create where train_id like '${train_id}';`
    const dbResponse1= await db.get(query1)
    response.send(dbResponse1)
  })

  app.post("/api/signup", async (request, response) => {
    const { username, password, email} = request.body;
    const hashedPassword = await bcrypt.hash(request.body.password, 10);
    let num1=Math.ceil(100000+Math.random()*100000)
    const selectUserQuery = `SELECT * FROM register WHERE username like '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      const createUserQuery = `
          INSERT INTO 
            register (username,password, email, user_id) 
          VALUES 
            (
              '${username}', 
              '${hashedPassword}',
              '${email}',
              '${num1}'
            )`;
      const dbResponse = await db.run(createUserQuery);
      const result = {"status":"Account successfully created","status_code":200,"user_id":`${num1}`}
      response.send(result);
    } else {
      response.status = 400;
      response.ok = false;
      response.send("Username already exists");
    }
  })

  app.get("/register/get/", async (request, response) => {
    console.log(25)
    const query = `select * from register;`
    const dbResponse= await db.all(query)
    response.send(dbResponse);
  })

  app.post("/api/login", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM register WHERE username = '${username}'`;
    const dbUser1 = await db.get(selectUserQuery);
    // if (dbUser1 === undefined) {
    //   response.status(400);
    //   response.send("Invalid User");
    // }
    if (dbUser1 !== undefined) {
      const isPasswordMatched = await bcrypt.compare(password, dbUser1.password);
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({"status":"Login successfull", "status_code":200, "user_id":`${dbUser1.user_id}`, "access_token":jwtToken });
      } else {
        
        response.send({"status":"Incorrect username/password provided, Please retry", "status_code":401});
      }
    }
    else{
      response.send({"status":"Incorrect username/password provided, Please retry", "status_code":401});
    }
    
  });

  app.get("/api/trains/availability/", async (request, response) => {
    const {source, destination}=request.query
    const query = `select train_id,train_name,seat_capacity as available_seats from train_create where source like '${source}' and destination like '${destination}';`
    const dbResponse= await db.all(query)
    response.send(dbResponse);
  })

  app.post("/api/trains/create", async (request, response) => {
    const { train_name, source, destination, seat_capacity, arrival_time_at_source, arrival_time_at_destination,key } = request.body;
    const apiKey=process.env.API_KEY
    let num1=Math.ceil(1000000000+Math.random()*1000000000)
    if (key!==apiKey){
        response.send("Invalid admin")
    }
    else{
        const createUserQuery = `
        INSERT INTO 
          train_create (train_name, source, destination, seat_capacity, arrival_time_at_source, arrival_time_at_destination, train_id) 
        VALUES 
          (
            '${train_name}', 
            '${source}',
            '${destination}',
            ${seat_capacity},
            '${arrival_time_at_source}',
            '${arrival_time_at_destination}',
            "${num1}"
          )`;

          const dbResponse = await db.run(createUserQuery);
      // const newUserId = dbResponse.lastID;
      const result={"message":"Train added successfully", "train_id":`${num1}`}
      response.send(result);
    }
    
  });

  app.delete("/delete/train/:train_name",async(request,response)=>{
    const {train_name}=request.params
    const query=`delete from train_create where train_name like '%${train_name}%';`
    const dbResponse= await db.run(query)
    response.send("Deleted train successfully");
  })

  app.get("/trains/get/", async (request, response) => {
    const query = `select * from train_create;`
    const dbResponse= await db.all(query)
    response.send(dbResponse);
  })

  app.post("/api/trains/:train_id/book",authenticateToken, async (request, response) => {
    const { train_id } = request.params;
    const {user_id, no_of_seats}=request.body

    const options = {
      method: "GET"
  }

    let available =await fetch(`http://localhost:3030/seatsno/${train_id}`,options)
    console.log(available)
    const resdata = await available.json()
    let seats=resdata.seat_capacity
    console.log(seats)
    if (seats>=no_of_seats && seats>0){
      let array1 = [];
      for (let i = 1; i <= seats; i++) {
          array1.push(i);
       }
       console.log(array1)
       let start=array1.length-no_of_seats
      let seat_numbers=array1.slice(start)
      console.log(seat_numbers)
       let newAvaliable=seats-no_of_seats
       console.log(newAvaliable)
      const query2 = `update train_create set seat_capacity=${newAvaliable} where train_id like '${train_id}';`
       await db.run(query2)
  
  
      let num1=Math.ceil(1000000000+Math.random()*1000000000)
      console.log(num1)
      
          const createUserQuery = `
          INSERT INTO 
            booking_seat (user_id, no_of_seats, seat_numbers, booking_id, train_id) 
          VALUES 
            (
              '${user_id}', 
              ${no_of_seats},
              "${seat_numbers}",
              '${num1}',
              '${train_id}'
             
            );`
  
            const dbResponse = await db.run(createUserQuery);
        // const newUserId = dbResponse.lastID;
        const result={"message":"Seats booked successfully", "booking_id":`${num1}`, "seat_numbers":`${seat_numbers}`}
        response.send(result);
    }
    else{
      response.send({"ok":"Available seats are less"})
    }
    
  });

  // app.get("/booked/get/", async (request, response) => {
  //   const query = `select * from booking_seat;`
  //   const dbResponse= await db.all(query)
  //   response.send(dbResponse);
  // })


  app.get("/booking_details/get/:user_id",authenticateToken, async (request, response) => {
    const {user_id}=request.params
    const query = `select booking_id,booking_seat.train_id,train_name,user_id,no_of_seats,seat_numbers,arrival_time_at_source,arrival_time_at_destination from booking_seat inner join train_create on booking_seat.train_id=train_create.train_id where booking_seat.user_id like '${user_id}';`
    const dbResponse= await db.all(query)
    response.send(dbResponse);
  })
  