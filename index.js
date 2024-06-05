const express = require('express');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())


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

        // jwt token 
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })

            console.log(user)
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        // Logout
        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
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
        app.get('/camps/:id', async (req, res) => {
            const id = req.params.id
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await campsCollection.findOne(query)
            res.send(result)
        })

        app.post('/camps', async (req, res) => {
            const camps = req.body
            const result = await campsCollection.insertOne(camps)
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

        // participantscollection  api 
        app.post('/participant', async (req, res) => {
            const newParticipant = req.body
            const result = await participantsCollection.insertOne(newParticipant)
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