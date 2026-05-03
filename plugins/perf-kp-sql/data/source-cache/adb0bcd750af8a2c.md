<!-- source URL cache · perf-kp-sql LLM-as-Judge (a3) input -->
<!-- url: https://www.mongodb.com/docs/manual/administration/performance-tuning/ -->
<!-- url_final: https://www.mongodb.com/docs/manual/administration/performance-tuning/ -->
<!-- fetched_at: 2026-05-03T08:51:38.288Z -->
<!-- html_bytes: 502506 · text_chars: 19041 -->
<!-- used_by_cases: 5 -->
Performance Tuning - Database Manual - MongoDB Docs Join us at MongoDB.local London on 7 May to unlock new possibilities for your data. Use WEB50 to save 50%. 
Register now > 

Products Platform
Atlas Build and scale with an AI-ready platform 
Platform Services
Database Deploy a multi-cloud database Search Deliver engaging search experiences Vector Search Design intelligent apps with gen AI Stream Processing Integrate MongoDB and Kafka 

Self Managed
Enterprise Advanced Run and manage MongoDB yourself Community Edition Develop locally with MongoDB 
Tools
Compass Work with MongoDB data in a GUI Integrations Integrations with third-party services Relational Migrator Migrate to MongoDB with confidence 

View All Products Explore our full developer suite 
MongoDB 8.0 Our fastest version ever 

Build with MongoDB Atlas
Get started for free in minutes
Sign Up 

Test Enterprise Advanced
Develop with MongoDB on-premises
Download 

Try Community Edition
Explore the latest version of MongoDB
Download 

Resources Documentation
Atlas Documentation Get started using Atlas Server Documentation Learn to use MongoDB 

Tools and Connectors Learn how to connect to MongoDB MongoDB Drivers Use drivers and libraries for MongoDB 

Resources Hub Get help building the next big thing with MongoDB 

Connect
Community Join a global community of developers Courses and Certification Learn for free from MongoDB Events and Webinars Find an event or webinar near you 

Solutions Use cases
Artificial Intelligence Modernization Payments Serverless Development Gaming Intelligent Search Edge and Mobile 

Industries
Financial Services Telecommunications Healthcare Retail Public Sector Manufacturing 

Solutions Library Organized and tailored solutions to kick-start projects 

AI Applications Program
Expedite your AI journey with expert guidance
Learn more 

Startups and AI Innovators
For world-changing ideas and AI pioneers
Learn more 

Customer Case Studies
Hear directly from our users
See Stories 

Company Careers Start your next adventure Blog Read articles and announcements Newsroom Read press releases and news stories 

Partners Learn about our partner ecosystem Leadership Meet our executive team Company Learn more about who we are 

Contact Us
Reach out to MongoDB
Connect with an expert 

Investors
Visit our investor portal
Learn more 

Pricing 
Eng 

Support Sign In 

Get Started 

Products Platform
Atlas Build and scale with an AI-ready platform 
Platform Services
Database Deploy a multi-cloud database Search Deliver engaging search experiences Vector Search Design intelligent apps with gen AI Stream Processing Integrate MongoDB and Kafka 

Self Managed
Enterprise Advanced Run and manage MongoDB yourself Community Edition Develop locally with MongoDB 
Tools
Compass Work with MongoDB data in a GUI Integrations Integrations with third-party services Relational Migrator Migrate to MongoDB with confidence 

View All Products Explore our full developer suite 
MongoDB 8.0 Our fastest version ever 

Build with MongoDB Atlas
Get started for free in minutes
Sign Up 

Test Enterprise Advanced
Develop with MongoDB on-premises
Download 

Try Community Edition
Explore the latest version of MongoDB
Download 

Resources Documentation
Atlas Documentation Get started using Atlas Server Documentation Learn to use MongoDB 

Tools and Connectors Learn how to connect to MongoDB MongoDB Drivers Use drivers and libraries for MongoDB 

Resources Hub Get help building the next big thing with MongoDB 

Connect
Community Join a global community of developers Courses and Certification Learn for free from MongoDB Events and Webinars Find an event or webinar near you 

Solutions Use cases
Artificial Intelligence Modernization Payments Serverless Development Gaming Intelligent Search Edge and Mobile 

Industries
Financial Services Telecommunications Healthcare Retail Public Sector Manufacturing 

Solutions Library Organized and tailored solutions to kick-start projects 

AI Applications Program
Expedite your AI journey with expert guidance
Learn more 

Startups and AI Innovators
For world-changing ideas and AI pioneers
Learn more 

Customer Case Studies
Hear directly from our users
See Stories 

Company Careers Start your next adventure Blog Read articles and announcements Newsroom Read press releases and news stories 

Partners Learn about our partner ecosystem Leadership Meet our executive team Company Learn more about who we are 

Contact Us
Reach out to MongoDB
Connect with an expert 

Investors
Visit our investor portal
Learn more 

Pricing 
Eng 

Support Sign In 

Get Started 

Docs Home 

Get Started 
Development 
Database Manual

8.2 (Current)

Overview 
Documents 
Databases & Collections

Client Libraries 
Connect to Clusters

Database Users

CRUD Operations

Indexes

Data Modeling

Aggregation Operations

Search

Vector Search

Time Series

Change Streams

Transactions

Data Federation

In-Use Encryption

Development Checklist 
Replication

Sharding

Performance

Connection Pool

Performance Tuning 
Charts 
Reference

Support

Build AI Applications

AI Models 
AI Integrations

AI Agents 

Streaming Data

Atlas Stream Processing

Atlas Triggers

Release Notes

Server Release Notes

Atlas Release Notes

Search Release Notes 
Vector Search Release Notes 

Management 
Client Libraries 
Tools 
AI Models 
Atlas Architecture Center 

Docs Home 

Get Started 
Development 
Management 
Client Libraries 
Tools 
AI Models 
Atlas Architecture Center 

Database Manual

8.2 (Current)

Overview 
Documents 
Databases & Collections

Client Libraries 
Connect to Clusters

Database Users

CRUD Operations

Indexes

Data Modeling

Aggregation Operations

Search

Vector Search

Time Series

Change Streams

Transactions

Data Federation

In-Use Encryption

Development Checklist 
Replication

Sharding

Performance

Connection Pool

Performance Tuning 
Charts 
Reference

Support

Build AI Applications

AI Models 
AI Integrations

AI Agents 

Streaming Data

Atlas Stream Processing

Atlas Triggers

Release Notes

Server Release Notes

Atlas Release Notes

Search Release Notes 
Vector Search Release Notes 

Docs Menu

Ask MongoDB AI

Docs Home 
/ Development 
/ Performance 

Docs Home 
/ Development 
/ Performance 

Docs Home 
/ Development 
/ Performance 

Performance Tuning 

Copy page

MongoDB deployments can support large-scale databases with
high transaction volumes, making performance tuning essential.
Regular tuning helps identify issues within the cluster
early, allowing you to address them before they
impact system responsiveness or stability.
This document addresses some common methods to optimize
your deployment performance by using performance tuning
and helpful metrics. These methods apply to both
MongoDB Atlas clusters and self-managed deployments.
However, the tuning process is significantly easier
with MongoDB Atlas , which
automates many tasks and streamlines for efficiency.
For more information on performance, see MongoDB Performance . 
Run Your Queries at Top Speed 

To ensure optimal query performance, you can use metrics that reveal
query performance problems and tell you what to do if you find slow queries.
MongoDB log files record the execution time and method for each
query, allowing you to search for slow queries. The
database profiler 
logs queries exceeding a specified threshold.
If a query is slow, first access your query plans. For more information
on finding query plan data, see Explain Results . 
Ensure that your query performed an index scan, rather than
a collection scan.
An index scan limits the number of documents that MongoDB
inspects, while a collection scan requires that MongoDB reads
all documents in a collection. To learn more about how
to interpret plan results, see Interpret Explain Plan Results . 

If you see a lot of collection scans in your explain plan
results, consider adding an index . 
Note
Indexes can slow down writes and updates, so having too many
underutilized indexes may hinder document modifications or
insertions, depending on your workload.

Query Metrics 

You can also use the following query metrics to ensure
your query is running at top speed:
metrics.queryExecutor.scanned 
tells you how many documents were scanned to return your query results.
Ideally, the ratio of scanned documents
to returned documents is 1:1, which means MongoDB returns
all documents. Typically, the ratio is greater than 1,
indicating MongoDB does not return some scanned documents.

The ratio can be less than 1 or even 0,
indicating a covered query where the index contains all necessary data.

If MongoDB is scanning large numbers of documents
to respond to your query, you may be missing indexes or need to
optimize your query.

metrics.operation.scanAndOrder 
indicates the server's effort to sort query results.
A high Scan and Order number, such as 20 or more, indicates
that the server is having to sort results, increasing
query result time and server memory load.

To fix a high Scan and Order number, sort your indexes according
to query requirements, or add any missing indexes.
Generally, sort b-tree indexes in ascending order from
the leading field in the index, if it's a compound index.

The WiredTiger Ticket Number 
metric reflects the performance of the WiredTiger
storage engine.
WiredTiger read and write tickets are the WiredTiger storage engine's
concurrency control mechanism to manage the number of concurrent transactions.
Starting in version 7.0, MongoDB uses a dynamic algorithm to adjust the
maximum number of concurrent storage engine transactions,
optimizing database throughput during cluster overload.

The read and write tickets control the maximum number of concurrent transactions.
The WiredTiger ticket number should always be at 128. Sustained
values below 128 indicates a server delay and consequential potential issues.

You can use the serverStatus command to check the current number
of read and write tickets and their usage. Look at the queues.execution 
section to understand the current load and ticket availability.

To remedy a low WiredTiger ticket number:
Ensure that the Dynamic Adjustment feature is enabled to
manage ticket allocation automatically.

Ensure that your cluster has sufficient resources, such as
CPU and memory, to handle the workload.

If you are using MongoDB 3.2 or earlier,
upgrade to a later version that uses WiredTiger.

If you need to manually adjust the maximum number of concurrent
transactions, you can modify the storageEngineConcurrentReadTransactions and
storageEngineConcurrentWriteTransactions parameters.

Note
Take caution when modifying storageEngineConcurrentReadTransactions 
and storageEngineConcurrentWriteTransactions , as changing
these settings can lead to performance issues or errors. We recommend
you consult with MongoDB Support before changing these parameters.

Document Structure Antipatterns 

The query plan does not contain any metrics to reveal document structure
antipatterns , but you can look
for antipatterns when debugging slow queries. Be careful of the
following most common bad query practices that hurt performance:
Unbound arrays: Arrays in a document that can grow without
a size limit cause performance problems, because each time you update
the array, MongoDB must rewrite the array into the document. For more
information, see Avoid Unbounded Arrays . 

Embedded documents without bounds: MongoDB supports inserting documents
within documents, with up to 128 levels of nesting. Each MongoDB document,
including embedded documents, has a size limit of 16MB. An excessive number
of embedded documents can result in performance problems.
To mitigate excessive embedded documents, move embedded documents to separate
collections and reference them from the original document.
For more information, see Bloated Documents . 

Ensure a Top Speed Database 

MongoDB has thousands of metrics that track all aspects of database performance,
including reading, writing, and querying the database, as well as making
sure background maintenance tasks like backups don't hinder performance.
The following metrics help indicate problems with your
database so you can ensure its optimal performance.
Replication Lag 

Replication lag occurs when a secondary member of a replica set falls
behind the primary. To understand the cause of your replication lag, you
can examine the oplog -related metrics. However, the
following problems are the most common causes of replication lag:
A networking issue between the primary and secondary, making nodes unreachable

A secondary node applying data slower than the primary node

Insufficient write capacity, in which case you should add more shards

Slow operations on the primary node, blocking replication

Locking Performance Problems 

MongoDB's internal locking system is used to support simultaneous
queries while avoiding write conflicts and inconsistent reads.
Performance problems that are the result of locking occur when the
remaining number of available read or write tickets reaches zero,
meaning any new read or write requests will be queued until
a new read or write ticket is available.
Locking performance problems can indicate suboptimal
indexes and poor schema design patterns, which can
both lead to locks being held longer than necessary.

Open Cursors 

If the number of open cursors is rising without a corresponding
growth of traffic, this might be the result of poorly indexed
queries, or long-running queries due to large result sets.

Overloaded Clusters 

When performance tuning, it is important to recognize when your
total traffic, or the throughput of transactions through the system,
is rising beyond the planned capacity of your cluster. By keeping
track of growth in throughput, you can expand your cluster's capacity
efficiently.
The following metrics can help you track your cluster's throughput.
To find these metrics, run the serverStatus command and
examine the fields specified below.
Read and Write Operations 

The Read and Write Operations metrics indicate how much work the
cluster does. You can find read operations through the
opcounters.query field and write operations through
opcounters.insert , opcounters.update ,
and opcounters.delete , which count the total number
of insert, update, and delete operations, respectively.
The ratio of reads to writes depends on the
nature of the workloads running on the cluster.
Monitoring read and write operations over time allows
normal ranges and thresholds to be established.

As trends in read and write operations show growth in
throughput, you can gradually increase capacity.

Document Metrics and Query Executor 

Document Metrics and Query Executor indicate if the cluster is
too busy. Similarly to the Read and Write operations metric, there is
no right or wrong number for these metrics, but having a good idea
of what's normal helps you discern whether poor performance
is coming from large workload size or attributable to other reasons.
To retrieve Document Metrics, access the metrics.keysExamined 
and metrics.totalExecMicros fields. To retrieve Query Executor metrics,
examine the metrics.fromPlanCache field. You can find
all of these fields using the $queryStats aggregation stage.
MongoDB updates document metrics anytime you find a document
or insert a document. The more documents that you find,
insert, update or delete, the busier your cluster is.
Poor performance in a cluster that has plenty of capacity
usually indicates query problems.

The query executor tells you how many queries are being processed
by using two data points:
Scanned: The average rate per second over the selected sample period
of index items scanned during queries and query-plan evaluation.

Scanned objects: The average rate per second over the selected
sample period of documents scanned during queries and query-plan evaluation.

Hardware and Network Metrics 

Hardware and Network metrics can indicate that throughput is
rising and will exceed the capacity of computing infrastructure.
These metrics are gathered from the operating system and networking
infrastructure. To make these metrics useful for diagnostic
purposes, you must have a sense of what is normal.
If you are running MongoDB on-premises, you may be able to view
hardware and network metrics using Ops Manager , depending on your operating system.

While there are many metrics to track, some important
metrics to have a baseline range for are:
Disk latency

Disk IOPS

Number of Connections

Cluster and Key Resources 

A MongoDB cluster uses a variety of resources that the underlying
computing and networking infrastructure provides.
Number of Client Connections 

The Current Number of Client Connections metric, located in the
connections.current field in the serverStatus 
document, can indicate total load on a system. Keeping track of normal ranges
at various times of the day or week can help you quickly identify spikes in traffic.
A related metric, percentage of connections used, can indicate
when MongoDB is getting close to running out of available connections.

Storage Metrics 

Storage metrics track how MongoDB uses persistent storage. In the WiredTiger
storage engine, each collection and each index are individual files. When
you update a document in a collection, MongoDB re-writes the entire document.
If memory space metrics such as dbStats.dataSize ,
dbStats.indexSize , dbStats.storageSize , or the number
of documents in the database show a significant unexpected change while
the database traffic stays within ordinary ranges, it can indicate
problems such as data deletion or corruption, unexpected data growth, or index changes.

A sudden drop in dbStats.dataSize may indicate a large amount of
data deletion. If this drop is unexpected, you should quickly investigate.

Memory Metrics 

Memory metrics show how MongoDB uses the virtual memory
of the computing infrastructure that is hosting the cluster.
You can find memory metrics in the mem document
in the results of serverStatus . 
An increasing number of page faults or a growing amount of data
changed but not yet written to disk can indicate problems
related to the amount of memory available to the cluster.

Cache metrics can help determine if the working set is outgrowing the available cache.

Critical Errors 

MongoDB creates asserts 
mostly through errors that MongoDB captures as part of its logging process.
Monitoring the number of asserts created at various levels of
severity can provide a first level indication of unexpected problems.
Asserts can be message asserts, the most serious kind, or
warning assets, regular asserts, and user asserts.

Back
Tuning

Next
Charts

Rate this page 

On this page

Run Your Queries at Top Speed 
Ensure a Top Speed Database 
Overloaded Clusters 
Hardware and Network Metrics 
Cluster and Key Resources 
Critical Errors 

On this page
Run Your Queries at Top Speed 
Ensure a Top Speed Database 
Overloaded Clusters 
Hardware and Network Metrics 
Cluster and Key Resources 
Critical Errors
