const express = require('express');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const cors = require('cors');
const app = express()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;


app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://purelife-health.web.app",
        "https://purelife-health.firebaseapp.com",
    ]
}))
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zwicj3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const campsCollection = client.db('pureLife-health').collection("camps")
        const participantsCollection = client.db('pureLife-health').collection("participants")
        const usersCollection = client.db('pureLife-health').collection("users")
        const doctorsCollection = client.db('pureLife-health').collection("doctors")

        // jwt token 
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })

            console.log(user)
            res.send({ token })
        })

        // verify Token 
        const verifyToken = (req, res, next) => {
            console.log('from verify ajke', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const token = req.headers.authorization.split(' ')[1]
            console.log(token, 'split korle pai')
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })
            // next()
        }

        // verify organizer 
        const verifyOrganizer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const isOrganizer = user?.role === 'organizer'
            if (!isOrganizer) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // payment releted api 
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const campFees = req.body.campFees
            const pricecInCent = parseFloat(campFees) * 100

            const { client_secret } = await stripe.paymentIntents.create({
                amount: pricecInCent,
                currency: "usd",
                // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
                automatic_payment_methods: {
                    enabled: true,
                },
            })

            res.send({ clientSecret: client_secret })
        })
        // user collection api 
        //get a loogged user by email
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email })
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };

            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })
        // campsCollection api 
        app.get('/camps', async (req, res) => {
            const search = req.query.search;
            const date = req.query.date;
            const participant = req.query.participant;
            const filter = {
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { location: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { healthcareProfessional: { $regex: search, $options: 'i' } },
                ]
            }
            let options = {}
            if (participant) options = { sort: { participantCount: participant === 'asc' ? 1 : -1 } }
            if (date) options = { sort: { dateAndTime: date === 'asc' ? 1 : -1 } }

            const result = await campsCollection.find(filter, options).toArray()
            res.send(result)
        })
        app.get('/campsSix', async (req, res) => {
            const filter = {}
            const options = { sort: { participantCount: -1 } }
            const result = await campsCollection.find(filter, options).limit(6).toArray()
            res.send(result)
        })
        app.get('/camps/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await campsCollection.findOne(query)
            res.send(result)
        })

        app.get('/camps/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { organizerEmail: email }
            const result = await campsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/camps', verifyToken, verifyOrganizer, async (req, res) => {
            const camps = req.body
            const result = await campsCollection.insertOne(camps)
            res.send(result)
        })

        app.delete('/camps/delete/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await campsCollection.deleteOne(query)
            res.send(result)
        })

        app.patch('/camps/participants/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const { participantCount } = req.body
            const convertedParticipant = parseFloat(participantCount)
            console.log(convertedParticipant)
            const updateDoc = {
                $set: {
                    participantCount: convertedParticipant + 1
                }
            }
            const result = await campsCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        app.patch('/camps/update/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const newCamps = req.body
            const updateDoc = {
                $set: {
                    ...newCamps
                }
            }
            const result = await campsCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        // participantscollection  api 
        app.post('/participant', async (req, res) => {
            const newParticipant = req.body
            const result = await participantsCollection.insertOne(newParticipant)
            res.send(result)
        })
        app.get('/participant/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            console.log(email, 'from participant')
            const filter = { organizerEmail: email }
            const result = await participantsCollection.find(filter).toArray()
            res.send(result)
        })
        app.get('/participant/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            console.log(email, 'from participant user')
            const filter = { participantEmail: email }
            const result = await participantsCollection.find(filter).toArray()
            res.send(result)
        })
        app.delete('/participant/delete/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await participantsCollection.deleteOne(query)
            res.send(result)
        })

        // doctors api 
        app.get('/doctors', async (req, res) => {
            const result = await doctorsCollection.find().toArray()
            res.send(result)
        })
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('PureLife Server is comming now ')
})

app.listen(port, () => {
    console.log(`PureLife server is running now ${port}`)
})