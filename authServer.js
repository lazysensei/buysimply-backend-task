require('dotenv').config()
const express = require('express')
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express()
app.use(session({ 		//Usuage
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
  }));
const jwt = require('jsonwebtoken')

users = require('./data/staffs.json')
loans = require('./data/loans.json')

let refreshTokens = []

// Parse JSON bodies
app.use(bodyParser.json());

app.get('/loans/:status?/:email?/:expired?', (req, res) => {
    // Check if user is logged in
    
    if (!req.session.userEmail) {
        return res.send("Please login first!");
    }
 
    if( req.query.status === 'active' ) {
        filteredLoans = loans.filter(loan => loan.status === 'active')
    } else if ( req.query.status === 'pending' ) {
        filteredLoans = loans.filter(loan => loan.status === 'pending')
    } else {
        filteredLoans = loans   
    }

    if( req.query.email ) {
        filteredLoans = filteredLoans.filter(loan => loan.applicant.email === req.query.email)
    }

    if (req.query.expired === '1') {
        // Filter loans with dates in the past
        filteredLoans = filteredLoans.filter(loan => new Date(loan.createdAt) < new Date());
    } else{
        filteredLoans = loans;
    }    

    const userRole = req.session.userRole;

    // Check user level for access control
    if (userRole === 'staff') {
        // Render admin dashboard
        return res.json({
            "loans" : removeNestedKey(filteredLoans,'applicant.totalLoan')
        });
    } else {
        // Render user dashboard
        return res.json({
            "loans" : filteredLoans
        });
    }
});

app.delete('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
        refreshTokens = refreshTokens.filter(token => token !== req.body.token)
        return res.status(200).json({ message: 'Logout successful' });
    });
})
  
app.post('/login', (req, res) => {
    // Authenticate User
  
    const email = req.body.email
    const password = req.body.password

    const currentUser = users.find(currentUser => currentUser.email === email);

    if (!currentUser) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare passwords
    if (currentUser.password !== password) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = { name: email }
    const accessToken = generateAccessToken(user)
    const refreshToken = jwt.sign(user, process.env.REFRESH_SECRET_TOKEN)
    refreshTokens.push(refreshToken)
    req.session.userEmail = currentUser.email;
    req.session.userRole = currentUser.role;
    res.json({ accessToken: accessToken, refreshToken: refreshToken, userRole: currentUser.role, userEmail : currentUser.email })
})

app.delete('/loan', (req, res) => {

    const idToDelete = parseInt(req.query.id);

    if (isNaN(idToDelete)) {
        return res.status(400).json({ message: 'Invalid ID parameter' });
    }

    if (!req.session.userEmail) {
        return res.send("Please login first!");
    }

    if (req.session.userRole === 'staff') {
        // Render admin dashboard
        return res.send("Unauthorized access");

    } else {
        // Render user dashboard
        return loans.filter(loan => loan.id !== idToDelete);
    }
})

function removeNestedKey(array, nestedKeyPath) {
    // Split the nested key path
    const keys = nestedKeyPath.split('.');
    const lastKey = keys.pop();

    // Iterate over each object in the array
    array.forEach(obj => {
        let current = obj;

        // Traverse the object according to the path
        for (let key of keys) {
            if (current[key] && typeof current[key] === 'object') {
                current = current[key];
            } else {
                // If any intermediate key in the path does not exist or is not an object, move to the next object
                return;
            }
        }

        // Remove the last key from the object
        if (current && current.hasOwnProperty(lastKey)) {
            delete current[lastKey];
        }
    });

    return array;
}
  
function generateAccessToken(user) {
return jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '300000s' })
}

app.listen(4000)