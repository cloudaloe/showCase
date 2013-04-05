//
// todo: handle server disconnects as per https://github.com/felixge/node-mysql#server-disconnects,
//  https://github.com/felixge/node-mysql#error-handling,
//  and try-catching

//
// setup a listener and attach a content server to it
//

//var hostname = 'localhost';
console.log('Server starting');
var port = process.env.PORT || 1338;  // for Heroku runtime compatibility
var staticPath = './code';
var mysql = require('mysql');
var mysqlConnection = null;
//var events = require('events').EventEmitter;

//var step = require('step');

//var mysqlQ = require('mysql-queues');
//var transaction = mysqlConnection.createQueue();
//transaction.query...
//var creatingNewEntity = false;

var geoip = require('geoip-lite');
var queryString = require('querystring');
var server = require('http').createServer(requestHandler);
var static = require('node-static'); 
staticContentServer = new static.Server(staticPath, { cache: false });

function requestHandler(request, response) {

    //
    // IP to Geolocation translation package
    // Note that for proper utilization, it should only check
    // the IP upon a new TCP connection, not every http request
    //
    // var geo = geoip.lookup(request.connection.remoteAddress);
    // console.log(request.connection.remoteAddress, geo);
    //

    function apiError(textMessage)
    {
        textMessage = 'API Error: ' + textMessage;
        console.log(textMessage);
        response.writeHead(400, textMessage);
        response.end();
    }

    function confirmParamInApiRequest(postObject, paramName)
    {
        if (!postObject[paramName])
        {
            apiError('The API parameter ' + paramName + ' is required in this API request, but not included in it.')
            return false;
        }
        else
            return true;
    }

    function handleLevel1(postObject)
    {
        switch (postObject.command)
        {
            case 'data':
                if (confirmParamInApiRequest(postObject, 'apiKey'))
                {
                    // here need to extract all identifiers and start the real handling -
                    // entering the data into the database
                    response.writeHead(200, null);
                    response.end();
                }
                break;
            case undefined:
               apiError('no command specified in the request.');
                break;
            default:
                apiError('command ' + postObject.command + ' is not supported.');
        }
    }

	if (request.method == 'GET')
        //
        // a UI client page load
        //  delegated to node-static for serving it
        //
		staticContentServer.serve(request, response, function (err, res) {
            if (err) { 
                console.error("Error serving " + staticPath + request.url + " - " + err.message);
                response.writeHead(err.status, err.headers);
                response.end(); }
			else
                console.log("Served " + staticPath + request.url)});

    if (request.method == 'POST')
    {
        //
        // handle uploading new data
        // not delegated to node-static,
        // so we handle parsing and  responding ourselves
        //
        console.log('Handling post request from client ' + request.connection.remoteAddress +
            ' (port ' + request.connection.remotePort +')');
        //console.log('Request headers are:' + JSON.stringify(request.headers));

        //request.setEncoding("utf8");
        var data = '';

        request.on('data', function(chunk) {
            data += chunk.toString();
        });

        request.on('end', function() {
            var postObject = queryString.parse(data);
            //console.log('data', data);
            console.log(postObject);
            switch(postObject.version)
            {
                case undefined:
                    apiError('an  API version is not specified in the client request');
                    break;
                 case '0.1':
                    handleLevel1(postObject);
                    break;
                default:
                    apiError('the API version specified by the client request is not supported');
            }
        });
    }
}
		
server.listen(port, null, null, function(){ 
	console.log('Server listening on' + ': '  + port);});

function mysqlPush(statement, queryVars, doneCallBack)
{
    mysqlVerifyConnection();
    var time = process.hrtime();
    //console.log('about to execute statement: ', statement, ' ', queryVars);
    mysqlConnection.query(statement, queryVars, function(err, result) {
        if (err)
        {
            console.log('Error encountered executing in mysql: \n', statement, err);
            return err;
        }
        else
        {
            if (doneCallBack)
            {
                doneCallBack(result, time);
            }
            time = process.hrtime(time);
            //console.log('executed in mysql: ', statement, ' ', queryVars); //returned result:  \n', result );
            //console.log('execution took %d seconds and %d millieseoncds', time[0], time[1]/1000000);
            //console.log('executed in mysql: ', statement, ' ', queryVars, '\n', 'execution took %d seconds and %d millieseoncds', time[0], time[1]/1000000);
            return err;
        }
    });
}

//
// Utility function for running a query that should return a single result value
// It still for now returns a key value pair and not a single value,
// so extract the value of the key from its return
//
function mysqlGetSingleResult(statement, queryVars, doneCallBack)
{
    mysqlGet(statement, queryVars, function(result) {
        debugger;
        //console.log('mysqlGetSingleResult' + result, statement, queryVars);
        if (result.length == 1)
        {
            if (Object.keys(result[0]).length == 1)
                for (key in result[0])
                {
                    // it's javascript, need to skip the standard inherited object properties
                    if (result[0].hasOwnProperty(key))
                        doneCallBack(result[0][key]);
                }
            else
                console.log('Error getting single value from mysql: query result was not a single value as expected. The result follows \n', result);
        }
        else
            if (result.length == 0)
            {
                doneCallBack(null);
            }
            else
            {
                console.log('Error getting single value from mysql: query result was not a single value as expected. The result follows \n', result);
                //doneCallBack(null);
            }
    });
}

function mysqlGet(statement, queryVars, doneCallback)
{
    mysqlVerifyConnection();
    var time = process.hrtime();

    mysqlConnection.query(statement, queryVars, function(err, result) {
        if (err)
        {
            console.log('Error encountered executing in  mysql: \n', statement, err);
        }
        else
        {
            time = process.hrtime(time);
            console.log('MySQL access took %d seconds and %d millieseoncds', time[0], time[1]/1000000);
            console.log('executed in mysql: ', statement, ' ', queryVars); //returned result:  \n', result );

            //for (i=0; i<result.length; i++)  {console.log(result[i]);}
            //console.log(JSON.stringify(result));
            //console.log('mysqlGet' + statement + queryVars + result);
             doneCallback(result);
        }
    });
}

function mysqlInitDB()
{
    //
    // Initialize the database - should not be run as part of the normal flow
    // Run once, for dev environments
    //

    mysqlVerifyConnection();

    //
    // valuesTableName will be used as a table name, hence its length set according to
    // http://stackoverflow.com/questions/6868302/maximum-length-of-a-table-name-in-mysql.
    //
    // note that the mysql INT data type is being used, because node-mysql seems not to properly handle BIGINT at present,
    // may indicate BIGINT is not supported, as per Sep 2012.
    //
    var statement = 'create table masterLevel1 (accountKey INT UNSIGNED, ' +
                                                                                                             'identifierKey VARCHAR(64),' +
                                                                                                             'identifierVal VARCHAR(64),' +
                                                                                                             'metricID INT UNSIGNED)';


    mysqlPush(statement, null);

    var statement ='create table masterLevel2 (metricID INT UNSIGNED, ' +
                                                                                                            'datumName VARCHAR(100), ' +
                                                                                                            'datumUnit VARCHAR(100), ' +
                                                                                                            'datumTableName VARCHAR(64))';

    mysqlPush(statement, null);
}

function mysqlFindEntity(accountKey, identifiers, valName)
{
    // this has good chances of doing the job.
    /*
    select masterLevel1.MetricID, count(*) from masterLevel1, masterLevel2
    where
        (identifierKey = 'farm' and identifierVal = 1 and masterLevel1.metricID = masterLevel2.metricID)
        or
        (identifierKey = 'server' and identifierVal = 3 and masterLevel1.metricID = masterLevel2.metricID)
        or ...
    group by masterLevel1.MetricID
    */
    // then need to compare the count result (of each result metric) to the number of identifiers seeked:
    // larger - there's a multitude of entities who share the requested identifiers, stored in the db
    //                     this means there's more identifiers that need to be specified for getting to a specific entity
    // smaller - no single entity as requested, is stored in the database
   //  equal - we found the single metric ID for the requested single entity. This case we can return the metric ID.


    var statement = '';


    statement += 'where accountKey = ?';
    for (i=0; i<identifiers.length; i++)
    {
        statement += 'select metricID from masterLevel1'
    }

    for (i=0; i<identifiers.length; i++)
    {
        statement +=  'identifierKey = ' + identifierVal;
    }


}

/*mysqlGet('select * from masterLevel1 where apiKey = ?', apiKey, function(result){
 if (result.length>0)
 for (i=0; i<identifiers.length; i++)
 {
 if (!result)
 console.log('Entity ' + apiKey + ' not defined in mysql database');
 else
 console.log('Entity ' + apiKey + ' found in mysql database, and has entity values table ' + result + ' associated to it');
 }*/

//var events = require('events').EventEmitter;
//var mysqlNewEntityInitEvents = new events;
function functionRunSynchronizer(accountKey, identifiers, datumName)
{
    if (creatingNewEntity)
    {
        mysqlNewEntityInitEvents.once('mysqlNewEntityInit.done', mysqlNewEntityInit(accountKey, identifiers, datumName));
        mysqlNewEntityInit(accountKey, identifiers, datumName)
    }
     else
    {
        mysqlNewEntityInit(accountKey, identifiers, datumName)
    }
}

/*
//  frozen attempt to make a modular 'syncrhonize calls to a given function'
var serializer = new Object;
function serialize(funcName)
{
    if (!serializer[funcName])
    {
        serializer[funcName]=new Object();
        serializer[funcName].stack = new Array();
    }
}
var mysqlNewEntityInitSynchronizer = new serializer(mysqlNewEntityInit);
*/


stack = new Array(); // this is a global
function mysqlNewEntityInitSynchronizer()
{
    arguments = Array.prototype.slice.call(arguments);
    stack.push(arguments); // queue the arguments as an array
    if (stack.length == 1)
    {
        arguments.push(callDone);
        mysqlNewEntityInit.apply(mysqlNewEntityInit, arguments); // invoke the target function
    }

    function callDone()
    {
        stack.shift();
        if (stack.length > 0)
        {
            // invoke the target function with the queued arguments plus the callback
            var arguments = stack.shift();
            arguments.push(callDone)
            mysqlNewEntityInit.apply(mysqlNewEntityInit, arguments);
        }
    }
}

function mysqlNewEntityInit(accountKey, identifiers, datumName, doneCallBack)
{
    console.log(arguments.callee.name + ' starting');
    //var queryCompletionTracker = new events;
    //function queryCompletionTracker.on('done', function(where) {
    var count = 0;
    var time2 = process.hrtime();
    function queryCompletionTracker(where)
    {
        time2 = process.hrtime(time2);
        console.log('query completion %d took %d seconds and %d millieseoncds', count, time2[0], time2[1]/1000000);
        time2 = process.hrtime();

        console.log(count);
        count += 1;
        //console.log('done event hit for ' + where );
        //console.log('count is now' + count);
        if (count == 2 + identifiers.length)
        {
            time = process.hrtime(time);
            console.log('Creating new entity (not including commit) took %d seconds and %d millieseoncds', time[0], time[1]/1000000);
            var time4 = process.hrtime();
            mysqlPush('COMMIT', null,  function() {
                time4 = process.hrtime(time4);
                console.log('committing took %d seconds and %d millieseoncds', time4[0], time4[1]/1000000);

                doneCallBack();
            });
            console.log('committed');
        }
    }

    var time = process.hrtime();


    var time3 = process.hrtime();
    mysqlPush('START TRANSACTION', null, function(){
        time3 = process.hrtime(time3);
        console.log('starting the transaction took %d seconds and %d millieseoncds', time3[0], time3[1]/1000000);
        mysqlGetSingleResult('select max(metricID) from masterLevel2', null, function(metricID) {
            //
            //  first, get a unique ID to use for the new table
            // this ID determines the name of the table in which
            // the datums of the entity will be stored
            //
            //console.log(metricID);
            if (!metricID) // master table still empty
                metricID = 1;
             else
                metricID += 1;

            metricValuesTableName = 'dv' + metricID.toString();
            console.log('created new metric with metric id ', metricID);

            // create a table for the metric values
            mysqlPush('create table ' + metricValuesTableName + ' (timestamp TIMESTAMP, value float)', null, queryCompletionTracker ('create'));

            // create entries in the master tables
            for (i=0; i<identifiers.length; i++)
            {
                //console.log('before level 1 insert');
                mysqlPush('insert into masterLevel1 SET ?', {
                    accountKey: 'accountKey',
                    identifierKey: identifiers[i].key,
                    identifierVal: identifiers[i].val,
                    metricID:metricID
                },
                 null,
                queryCompletionTracker('insert level 1'));
            }

            mysqlPush('insert into masterLevel2 SET ?', {
                metricID:metricID,
                datumName: datumName,
                datumName: datumName,
                datumUnit:'percent',
                datumTableName: metricValuesTableName
            },
             null,
            queryCompletionTracker('insert level 2'));
        });
    });
}

function mysqlVerifyConnection()
{
    if (!mysqlConnection)
    {
         mysqlConnection = mysql.createConnection({
            debug   : false,
            host     : 'instance22681.db.xeround.com',
            port    : '14944',
            user     : 'cloudaloe',
            password : 'cloudaloe',
            database: 'hack'
         });
         mysqlConnection.connect(function(err){
            if (err)
            {
                console.log('Failed connecting to mysql \n', err);
            }
            else
                console.log('Connected to mysql');
        });
        //mysqlQ(mysqlConnection, false);
    }
}

function stupidTestMysqlDB()
{
    //var statement = 'SELECT * from table1';
    var statement = 'insert into table1 SET ?';
    //var statement = 'create table data (timestamp TIMESTAMP, value float)'

    var values  = {id: 5, name: 555};

    mysqlVerifyConnection();

    mysqlConnection.query(statement, values, function(err, result, fields) {
        //console.log(statement, values, rows.length, err);
        if (err) throw err;
        for (i=0; i<result.length; i++)
        {
            console.log(result[i]);
        }
    });
    mysqlConnection.end();
}

//mysqlInitDB();
//stupidTestMysqlDB();
//mysqlGetSingleResult('select max(metricID) from master', function(result) {console.log(result);});
//if (mysqlFindEntity(738229833, null))
//    console.log(found);

/*mysqlNewEntityInitSynchronizer('555555',
    [{key: 'datacenter', val:'DCAA'},
        {key: 'server', val:'server1'}],
    'load');
mysqlNewEntityInitSynchronizer('555555',
    [{key: 'datacenter', val:'DCAA'},
        {key: 'server', val:'server2'}],
    'load');
mysqlNewEntityInit('555555',
    [{key: 'datacenter', val:'DCBB'},
        {key: 'server', val:'server7'}],
    'load');
mysqlNewEntityInit('555555',
    [{key: 'datacenter', val:'datacBB'},
        {key: 'server', val:'server2'}],
    'load');
*/
// TODO: handle table name counter overflow