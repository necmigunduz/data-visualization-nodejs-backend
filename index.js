const multer = require('multer');
const csv = require('fast-csv');
const mongodb = require('mongodb');
const fs = require('fs');
const express = require('express');
const app = express();

// Set Global Directory
global.__basedir = __dirname;
// Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname)
    }
})

const csvFilter = (req, file, cb) => {
    if(file.mimetype.includes("csv")) {
        cb(null, true)
    } else {
        cb("Please upload only csv file", false)
    }
}

const upload = multer({ storage: storage, fileFilter: csvFilter })

// Upload csv
app.post('/api/upload-csv-file', upload.single("file"), (req, res) => {
    try {
        if(req.file == undefined) {
            return res.status(400).send({
                message: "Please upload a csv file!"
            })
        }
        
        let csvData= []
        let filePath = __basedir + '/uploads/' + req.file.filename
        fs.createReadStream(filePath)
            .pipe(csv.parse({headers: true}))
            .on("error", (error) => {
                throw error.message
            })
            .on("data", (row) => {
                csvData.push(row)
            })
            .on("end", () => {
                var url = "mongodb://localhost:27017/TestDB";
                var dbConn;
                mongodb.MongoClient.connect(url, {
                    useUnifiedTopology: true
                }).then((client) => {
                    console.log('DB Connected!')
                    dbConn = client.db()

                    var collectionName = 'statistics'
                    var collection = dbConn.collection(collectionName)
                    collection.insertMany(csvData, (err, result) => {
                        if(err) console.log(err)
                        if(result) {
                            res.status(200).send({
                                message: "Upload/import the CSV data into database successfully: " 
                                + req.file.originalname
                            })
                        }
                    })
                }).catch(err => {
                    res.status(500).send({
                        message: "Fail to import data into database!",
                        error: err.message,
                    })
                })
            })
    } catch(error) {
        console.log("catch error~", error)
        res.status(500).send({
            message: "Could not upload the file: " + req.file.originalname
        })
    }
})

app.get('/api/statistics', function(req,res) {
    var url = "mongodb://localhost:27017/TestDB";
    var dbConn;
    mongodb.MongoClient.connect(url, {
        useUnifiedTopology: true,
    }).then((client) => {
        dbConn = client.db()

        var collectionName = 'statistics'
        var collection = dbConn.collection(collectionName)
        collection.find().toArray(function(err, result){
            if(err) throw err
            res.status(200).send({ statistics : result })
            client.close()
        })
    }).catch(err => {
        res.status(500).send({
            message: "Fail to fetch data from database!",
            error: err.message,
        })
    })
})

// Create server
let server =  app.listen(5000, function() {
    let port = server.address().port
    console.log("App Server running at - https://localhost:%s", port)
})
