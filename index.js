const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000;

app.use(cors())
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

        app.get('/camps', async (req, res) => {
            const result = await campsCollection.find().toArray()
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