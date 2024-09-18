import express from "express";
import bodyParser from "body-parser"
import pg from "pg";


const app = express();
const port = 3000;
app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "anonymous-poll-project",
    password: "123456",
    port: 5432,
})


db.connect();

let codes = [];
let codeInUse = "";

const middleware = {
    checkIdentificationCode: async function checkIdentificationCode(req, res, next) {

        const input = req.body.inputCode;
        const voted = true;
        codeInUse = input;
        
        //gets all preapproved codes and puts them in an array
        const idData = await db.query("SELECT * FROM identification_codes");
        idData.rows.forEach((code) => codes.push(code.code))

        //gets the status of the user input code (has_voted)
        const codeStatus = await db.query("SELECT has_voted FROM identification_codes WHERE code = $1", [input]);

        //checks that the code exists in the preapproved codes and has not been used before
        const validCode = codes.indexOf(input) !== -1 && codeStatus.rows[0].has_voted === false;
    
        
        //if the code is valid, lets the user get to the voting page, if not lets them know something is wrong
    if(validCode)  {
        try { 
            await db.query("UPDATE identification_codes SET has_voted = ($1) WHERE code = $2", [voted, input]);
           
            const dbOptions = await db.query("SELECT option FROM voting_options");
            const options = []
            dbOptions.rows.forEach((option) => options.push(option.option));
            res.render("votingPage.ejs",{options});
        } catch (err) {
            console.log("eroare!", err);
        };
    } else {
        res.render("codeError.ejs");
    };
    next();
    },
    registerVote: async function registerVote(req, res, next) {
        let alreadyVoted = [];

let [votedOption] = Object.values(req.body);
const numberOfVotes = await db.query("SELECT votes FROM voting_options WHERE option = $1", [votedOption])
let addOneVote = numberOfVotes.rows[0].votes + 1;

//gets all the codes that have already voted
const usedCodes = await db.query("SELECT voter FROM voted");
usedCodes.rows.forEach((code) => alreadyVoted.push(code.voter));

//registers vote and voter / redirects codes that have already voted
if(alreadyVoted.indexOf(codeInUse) === -1) {
    try {
        await db.query("UPDATE voting_options SET votes = ($1) WHERE option = $2", [addOneVote, votedOption]);
        await db.query("INSERT INTO voted (voter) VALUES ($1)", [codeInUse]);
        
    } catch (err) {
        console.log("Error:", err);
    }
    res.render("yay.ejs");
} else {
    res.render("no.ejs");
}
next();
    }
}


//renders home page
app.get("/", async (req, res) => {
    res.render("index.ejs")
});

//verifies code and lets approved users get to the voting page
app.post("/identification", middleware.checkIdentificationCode,  (req, res) => {
})

//gets vote and updates votes and used codes in data base
app.post("/vote", middleware.registerVote, (req, res) => {
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });