---
source: https://www.mongodb.com/docs/manual/core/query-optimization/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "MongoDB 查询优化与索引管理指南（官方整合版）"
last_verified: 2026-04-11
topics: 查询优化, 索引构建, Profiler慢查询分析, explain
---

# MongoDB 查询优化与索引管理指南

> 整合自 MongoDB 官方文档：Query Optimization + Index Builds + Database Profiler

---

## 第一部分：查询优化 (Query Optimization)

> 来源: https://www.mongodb.com/docs/manual/core/query-optimization/


# MongoDB 查询优化 (官方)

> 来源: https://www.mongodb.com/docs/manual/core/query-optimization/

- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
- [Management](https://www.mongodb.com/docs/management/)
- [Tools](https://www.mongodb.com/docs/tools-and-connectors/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[Get Started](https://www.mongodb.com/docs/get-started/)
[Development](https://www.mongodb.com/docs/development/)
- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
[Overview](https://www.mongodb.com/docs/manual/)
[Documents](https://www.mongodb.com/docs/manual/core/document/)
[Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
[Insert](https://www.mongodb.com/docs/manual/tutorial/insert-documents/)
[Query](https://www.mongodb.com/docs/manual/tutorial/query-documents/)
[Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)

[Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
[Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
[Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
[Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
[SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
[Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
[Text Search](https://www.mongodb.com/docs/manual/text-search/)
[Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
[Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
[Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)
[Atomicity & Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
[Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)
[Periods & Dollar Signs](https://www.mongodb.com/docs/manual/core/dot-dollar-considerations/)
[Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance/)
[Write Operation Performance](https://www.mongodb.com/docs/manual/core/write-performance/)
[Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
[Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
[Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
[Indexes](https://www.mongodb.com/docs/manual/indexes/)
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
[Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
[Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
[Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
[Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
[In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
[Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
[Replication](https://www.mongodb.com/docs/manual/replication/)
[Sharding](https://www.mongodb.com/docs/manual/sharding/)
[Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
[Charts](https://www.mongodb.com/docs/charts/)
[Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Management](https://www.mongodb.com/docs/management/)

[Tools](https://www.mongodb.com/docs/tools-and-connectors/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Docs Home](https://www.mongodb.com/docs/)
- [Get Started](https://www.mongodb.com/docs/get-started/)
- [Management](https://www.mongodb.com/docs/management/)
- [Tools](https://www.mongodb.com/docs/tools-and-connectors/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Docs Home](https://www.mongodb.com/docs/)
[Get Started](https://www.mongodb.com/docs/get-started/)
[Development](https://www.mongodb.com/docs/development/)
[Management](https://www.mongodb.com/docs/management/)
[Tools](https://www.mongodb.com/docs/tools-and-connectors/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
[Overview](https://www.mongodb.com/docs/manual/)
[Documents](https://www.mongodb.com/docs/manual/core/document/)
[Databases & Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/)
[Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
[Insert](https://www.mongodb.com/docs/manual/tutorial/insert-documents/)
[Query](https://www.mongodb.com/docs/manual/tutorial/query-documents/)
[Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
[Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
[Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)

[Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
[Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
[SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
[Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
[Text Search](https://www.mongodb.com/docs/manual/text-search/)
[Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
[Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
[Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)
[Atomicity & Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
[Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)
[Periods & Dollar Signs](https://www.mongodb.com/docs/manual/core/dot-dollar-considerations/)
[Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
[Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance/)
[Write Operation Performance](https://www.mongodb.com/docs/manual/core/write-performance/)
[Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
[Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
[Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
[Indexes](https://www.mongodb.com/docs/manual/indexes/)
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
[Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
[Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
[Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
[Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
[In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
[Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
[Replication](https://www.mongodb.com/docs/manual/replication/)
[Sharding](https://www.mongodb.com/docs/manual/sharding/)
[Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
[Charts](https://www.mongodb.com/docs/charts/)
[Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Docs Home](https://www.mongodb.com/docs/)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud)
[Docs Home](https://www.mongodb.com/docs/)
[Development](https://www.mongodb.com/docs/development)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud)

[Docs Home](https://www.mongodb.com/docs/)
[Development](https://www.mongodb.com/docs/development)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud)

Query optimization reduces the amount of data a query must process. Use indexes, projections, and query limits to improve performance and reduce resource consumption. Review query performance periodically as collections grow to determine when to scale.

Create indexes for your most common queries. If a query searches multiple fields, create a [compound index.](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/#std-label-index-type-compound)

```
type
```

```
inventory
```

```
```

```
```

To improve performance on this query, add an index on the type field.

```
type
```

```
db.inventory.createIndex( { type: 1 } )
```

```
db.inventory.createIndex( { type: 1 } )
```

## https://www.mongodb.com/docs/manual/core/query-optimization/#create-indexes-to-support-queriesCreate Indexes to Support Queries

```
mongosh
```

```
db.collection.createIndex()
```

To analyze query performance, see [Interpret Explain Plan Results.](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/)
[1](https://www.mongodb.com/docs/manual/core/query-optimization/#ref-ensureIndexOrder-id1)
[Compound Index Sort Order.](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/sort-order/#std-label-index-ascending-and-descending)

## https://www.mongodb.com/docs/manual/core/query-optimization/#create-selective-queriesCreate Selective Queries
Query selectivity measures how well a query predicate filters documents and determines whether queries can use indexes effectively.
- Highly selective queries match fewer documents and use indexes
more effectively. For instance, an equality match on _id is highly
selective as it can match at most one document.
- Less selective queries match more documents and use indexes
less efficiently.
Highly selective queries match fewer documents and use indexes more effectively. For instance, an equality match on _id is highly selective as it can match at most one document.

```
_id
```

Less selective queries match more documents and use indexes less efficiently.
For instance, the inequality operators [[[$nin](https://www.mongodb.com/docs/manual/reference/operator/query/nin/#mongodb-query-op.-nin)](https://www.mongodb.com/docs/manual/reference/operator/query/nin/#mongodb-query-op.-nin)](https://www.mongodb.com/docs/manual/reference/operator/query/nin/#mongodb-query-op.-nin) and [[[$ne](https://www.mongodb.com/docs/manual/reference/operator/query/ne/#mongodb-query-op.-ne)](https://www.mongodb.com/docs/manual/reference/operator/query/ne/#mongodb-query-op.-ne)](https://www.mongodb.com/docs/manual/reference/operator/query/ne/#mongodb-query-op.-ne) are not very selective since they often match a large portion of the index. As a result, in many cases, a $nin or $ne query with an index may perform no better than a $nin or $ne query that must scan all documents in a collection.

```
$nin
```

```
$ne
```

```
$nin
```

```
$ne
```

```
$nin
```

```
$ne
```

The selectivity of a [regular expression](https://www.mongodb.com/docs/manual/reference/operator/query/regex/#mongodb-query-op.-regex) depends on the expression itself. For details, see [regular expression and index use.](https://www.mongodb.com/docs/manual/reference/operator/query/regex/#std-label-regex-index-use)

```
regular expression
```

When you need a subset of fields from documents, you can improve performance by returning only the fields you need. Projections reduce network traffic and processing time.
For example, consider the following query to return only the timestamp, title, author, and abstract fields.

```
timestamp
```

```
title
```

```
author
```

```
abstract
```

```
db.posts.find( {}, { timestamp : 1, title : 1, author : 1, abstract : 1}).sort( { timestamp : -1 } )
```

```
db.posts.find( {}, { timestamp : 1, title : 1, author : 1, abstract : 1}).sort( { timestamp : -1 } )
```

When you use a [$project](https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/#mongodb-pipeline-pipe.-project) aggregation stage it should typically be the last stage in your pipeline, used to specify which fields to return to the client.

```
$project
```

Using a $project stage at the beginning or middle of a pipeline to reduce the number of fields passed to subsequent pipeline stages is unlikely to improve performance, because the database performs this optimization automatically.

```
$project
```

For more information, see [Project Fields to Return from Query.](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/#std-label-read-operations-projection)

To achieve a covered query, index the projected fields. The [ESR (Equality, Sort, Range) rule](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/#std-label-esr-indexing-guideline) applies to the order of fields in the index.
For example, consider the following index on the inventory collection:

```
inventory
```

```
db.inventory.createIndex( { type: 1, _id: 1, price: 1, item: 1, expiryDate: 1} )
```

```
db.inventory.createIndex( { type: 1, _id: 1, price: 1, item: 1, expiryDate: 1} )
```

The above query, while technically correct, is not structured to optimize query performance.
The following query applies the ESR rule for a more efficient compound index:

```
db.inventory.aggregate([ { $match: {type: "food", expiryDate: { $gt: ISODate("2025-07-10T00:00:00Z") }}}, { $sort: { item: 1 }}, { $project: { _id: 1, price: 1} }])
```

```
db.inventory.aggregate([ { $match: {type: "food", expiryDate: { $gt: ISODate("2025-07-10T00:00:00Z") }}}, { $sort: { item: 1 }}, { $project: { _id: 1, price: 1} }])
```

The index and query follow the ESR rule:
- type is used for an equality match (E), so it is the first field in the index.
- item is used for sorting (S), so it is after type in the index.
- expiryDate is used for a range query (R), so it is the last field in the index.
type is used for an equality match (E), so it is the first field in the index.

```
type
```

item is used for sorting (S), so it is after type in the index.

```
item
```

```
type
```

expiryDate is used for a range query (R), so it is the last field in the index.

```
expiryDate
```

## https://www.mongodb.com/docs/manual/core/query-optimization/#limit-query-resultsLimit Query Results
MongoDB [cursors](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-cursor) return results in batches. If you know how many results you need, pass that value to the [limit()](https://www.mongodb.com/docs/manual/reference/method/cursor.limit/#mongodb-method-cursor.limit) method to reduce network resource usage.

```
limit()
```

Limit results after sorting so you know which documents are returned. For example, the following query returns only the 10 most recent results from the posts collection:

```
posts
```

```
db.posts.find().sort( { timestamp : -1 } ).limit(10)
```

```
db.posts.find().sort( { timestamp : -1 } ).limit(10)
```

For more information, see [limit().](https://www.mongodb.com/docs/manual/reference/method/cursor.limit/#mongodb-method-cursor.limit)

```
limit()
```

## https://www.mongodb.com/docs/manual/core/query-optimization/#use-index-hintsUse Index Hints
The [query optimizer](https://www.mongodb.com/docs/manual/core/query-plans/#std-label-read-operations-query-optimization) selects the optimal index for a specific operation. However, you can force a specific index using the [hint()](https://www.mongodb.com/docs/manual/reference/method/cursor.hint/#mongodb-method-cursor.hint) method. This is useful for performance testing or when a field appears in several indexes and you need to guarantee which index MongoDB uses.

```
hint()
```

## https://www.mongodb.com/docs/manual/core/query-optimization/#use-server-side-operationsUse Server-Side Operations
Use the [$inc](https://www.mongodb.com/docs/manual/reference/operator/update/inc/#mongodb-update-up.-inc) operator to increment or decrement values in documents. The operator increments the field value on the server side, as an alternative to selecting a document, making simple modifications on the client side, and then writing the document to the server. Additionaly, the operator prevents race conditions when multiple application instances update the same field concurrently.

```
$inc
```

## https://www.mongodb.com/docs/manual/core/query-optimization/#run-covered-queriesRun Covered Queries
A covered query is a query than can be satisfied entirely by an index without having to examine any documents. An index covers a query when all of the following are true:
- All the fields in the query (including fields specified by the application
and any fields needed internally, such as for sharding) are part of the index.
- All the fields returned in the results are in the same index.
- No fields in the query are equal to null. For example, the
following query predicates cannot result in covered queries:{ "field": null }{ "field": { $eq: null } }
- { "field": null }
- { "field": { $eq: null } }
All the fields in the query (including fields specified by the application and any fields needed internally, such as for sharding) are part of the index.
All the fields returned in the results are in the same index.
No fields in the query are equal to null. For example, the following query predicates cannot result in covered queries:

```
null
```

- { "field": null }
- { "field": { $eq: null } }
{ "field": null }

```
{ "field": null }
```

{ "field": { $eq: null } }

```
{ "field": { $eq: null } }
```

### https://www.mongodb.com/docs/manual/core/query-optimization/#example-1Example
An inventory collection has the following index on the type and item fields:

```
inventory
```

```
type
```

```
item
```

```
db.inventory.createIndex( { type: 1, item: 1 } )
```

```
db.inventory.createIndex( { type: 1, item: 1 } )
```

The index covers the following query, which filters on type and item and returns only item:

```
type
```

```
item
```

```
item
```

```
db.inventory.find( { type: "food", item:/^c/ }, { item: 1, _id: 0 })
```

```
db.inventory.find( { type: "food", item:/^c/ }, { item: 1, _id: 0 })
```

For the specified index to cover the query, the projection document must explicitly specify _id: 0 to exclude the _id field from the result since the index does not include the _id field.

```
_id: 0
```

```
_id
```

```
_id
```

### https://www.mongodb.com/docs/manual/core/query-optimization/#embedded-documentsEmbedded Documents
An index can cover a query on fields within embedded documents.
For example, consider the following userdata collection:

```
userdata
```

```
db.userdata.insertOne( { _id: 1, user: { login: "tester" } })
```

```
db.userdata.insertOne( { _id: 1, user: { login: "tester" } })
```

The collection has the following index:

```
db.userdata.createIndex( { "user.login": 1 })
```

```
db.userdata.createIndex( { "user.login": 1 })
```

The { "user.login": 1 } index covers the following query:

```
{ "user.login": 1 }
```

```
db.userdata.find( { "user.login": "tester" }, { "user.login": 1, _id: 0 })
```

```
db.userdata.find( { "user.login": "tester" }, { "user.login": 1, _id: 0 })
```

To index fields in embedded documents, use [dot notation](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-dot-notation). See [Create an Index on an Embedded Field.](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-single/create-single-field-index/#std-label-index-embedded-fields)

### https://www.mongodb.com/docs/manual/core/query-optimization/#multikey-coveringMultikey Covering
Multikey indexes can cover queries over non-array fields if the index tracks which field or fields make it multikey.
[Multikey indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/#std-label-index-type-multikey) cannot cover queries over array fields.
For an example, see [Covered Queries](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/#std-label-multikey-covered-queries) on the multikey indexes page.

### https://www.mongodb.com/docs/manual/core/query-optimization/#performancePerformance
Covered queries match [query conditions](https://www.mongodb.com/docs/manual/tutorial/query-documents/#std-label-read-operations-query-document) and return results using only the index. This is faster than fetching documents because index keys are typically smaller than documents and indexes are usually in RAM or stored sequentially on disk.

### https://www.mongodb.com/docs/manual/core/query-optimization/#limitationsLimitations
#### https://www.mongodb.com/docs/manual/core/query-optimization/#index-typesIndex Types
Not all [index types](https://www.mongodb.com/docs/manual/core/indexes/index-types/#std-label-index-types) support covered queries. See the documentation for the specific index type.

#### https://www.mongodb.com/docs/manual/core/query-optimization/#sharded-collectionsSharded Collections
When run on [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#std-program-mongos), indexes can only cover queries on [sharded](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-shard) collections if the index contains the shard key.

```
mongos
```

To check whether a query is covered, use [db.collection.[explain()](https://www.mongodb.com/docs/manual/reference/method/cursor.explain/#mongodb-method-cursor.explain)](https://www.mongodb.com/docs/manual/reference/method/db.collection.explain/#mongodb-method-db.collection.explain) or explain(). See [Covered Queries.](https://www.mongodb.com/docs/manual/reference/explain-results/#std-label-explain-output-covered-queries)

```
db.collection.explain()
```

```
explain()
```

Back
Causal Consistency and Read and Write Concerns
Next
Analyze Query Performance

###### Earn a Skill Badge
Master "Query Optimization" for free!
On this page

- [Project Only Necessary Data](https://www.mongodb.com/docs/manual/core/query-optimization/#project-only-necessary-data)
- [Limit Query Results](https://www.mongodb.com/docs/manual/core/query-optimization/#limit-query-results)
- [Use Index Hints](https://www.mongodb.com/docs/manual/core/query-optimization/#use-index-hints)
- [Use Server-Side Operations](https://www.mongodb.com/docs/manual/core/query-optimization/#use-server-side-operations)
- [Run Covered Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#run-covered-queries)
[Create Indexes to Support Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#create-indexes-to-support-queries)
[Create Selective Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#create-selective-queries)
[Project Only Necessary Data](https://www.mongodb.com/docs/manual/core/query-optimization/#project-only-necessary-data)

[Limit Query Results](https://www.mongodb.com/docs/manual/core/query-optimization/#limit-query-results)
[Use Index Hints](https://www.mongodb.com/docs/manual/core/query-optimization/#use-index-hints)
[Use Server-Side Operations](https://www.mongodb.com/docs/manual/core/query-optimization/#use-server-side-operations)
[Run Covered Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#run-covered-queries)
On this page
- [Create Indexes to Support Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#create-indexes-to-support-queries)
- [Create Selective Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#create-selective-queries)
- [Project Only Necessary Data](https://www.mongodb.com/docs/manual/core/query-optimization/#project-only-necessary-data)
- [Limit Query Results](https://www.mongodb.com/docs/manual/core/query-optimization/#limit-query-results)
- [Use Index Hints](https://www.mongodb.com/docs/manual/core/query-optimization/#use-index-hints)
- [Use Server-Side Operations](https://www.mongodb.com/docs/manual/core/query-optimization/#use-server-side-operations)
- [Run Covered Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#run-covered-queries)
[Create Indexes to Support Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#create-indexes-to-support-queries)
[Create Selective Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#create-selective-queries)
[Project Only Necessary Data](https://www.mongodb.com/docs/manual/core/query-optimization/#project-only-necessary-data)
[Limit Query Results](https://www.mongodb.com/docs/manual/core/query-optimization/#limit-query-results)
[Use Index Hints](https://www.mongodb.com/docs/manual/core/query-optimization/#use-index-hints)
[Use Server-Side Operations](https://www.mongodb.com/docs/manual/core/query-optimization/#use-server-side-operations)
[Run Covered Queries](https://www.mongodb.com/docs/manual/core/query-optimization/#run-covered-queries)


---

## 第二部分：索引构建 (Index Builds)

> 来源: https://www.mongodb.com/docs/manual/core/index-creation/


# MongoDB 索引构建 (官方)

> 来源: https://www.mongodb.com/docs/manual/core/index-creation/

[Server DocumentationLearn to use MongoDB](https://www.mongodb.com/docs/manual/)
[Tools and ConnectorsLearn how to connect to MongoDB](https://www.mongodb.com/docs/tools-and-connectors/)

[IntegrationsIntegrations with third-party services](https://cloud.mongodb.com/ecosystem/?filter=integration)
[Server DocumentationLearn to use MongoDB](https://www.mongodb.com/docs/manual/)
[Tools and ConnectorsLearn how to connect to MongoDB](https://www.mongodb.com/docs/tools-and-connectors/)

- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)

- [Types](https://www.mongodb.com/docs/manual/core/indexes/index-types/)
- [Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)

- [Manage](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/)
- [Measure Use](https://www.mongodb.com/docs/manual/tutorial/measure-index-use/)
- [Strategies](https://www.mongodb.com/docs/manual/applications/indexes/)
- [Reference](https://www.mongodb.com/docs/manual/reference/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
- [Management](https://www.mongodb.com/docs/management/)
- [Tools](https://www.mongodb.com/docs/tools-and-connectors/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[Get Started](https://www.mongodb.com/docs/get-started/)
[Development](https://www.mongodb.com/docs/development/)
- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)

- [Types](https://www.mongodb.com/docs/manual/core/indexes/index-types/)
- [Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)

- [Manage](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/)
- [Measure Use](https://www.mongodb.com/docs/manual/tutorial/measure-index-use/)
- [Strategies](https://www.mongodb.com/docs/manual/applications/indexes/)
- [Reference](https://www.mongodb.com/docs/manual/reference/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
[Overview](https://www.mongodb.com/docs/manual/)
[Documents](https://www.mongodb.com/docs/manual/core/document/)
[Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)

[CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
[Indexes](https://www.mongodb.com/docs/manual/indexes/)
[Create](https://www.mongodb.com/docs/manual/core/indexes/create-index/)
[Drop](https://www.mongodb.com/docs/manual/core/indexes/drop-index/)
[Types](https://www.mongodb.com/docs/manual/core/indexes/index-types/)
[Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)
[Rolling Index Builds](https://www.mongodb.com/docs/manual/core/rolling-index-builds/)
[Manage](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/)
[Measure Use](https://www.mongodb.com/docs/manual/tutorial/measure-index-use/)
[Strategies](https://www.mongodb.com/docs/manual/applications/indexes/)
[Reference](https://www.mongodb.com/docs/manual/reference/indexes/)
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
[Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
[Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
[Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
[Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
[In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
[Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
[Replication](https://www.mongodb.com/docs/manual/replication/)
[Sharding](https://www.mongodb.com/docs/manual/sharding/)
[Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
[Charts](https://www.mongodb.com/docs/charts/)
[Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Management](https://www.mongodb.com/docs/management/)
[Tools](https://www.mongodb.com/docs/tools-and-connectors/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Docs Home](https://www.mongodb.com/docs/)
- [Get Started](https://www.mongodb.com/docs/get-started/)

- [Management](https://www.mongodb.com/docs/management/)
- [Tools](https://www.mongodb.com/docs/tools-and-connectors/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)

- [Types](https://www.mongodb.com/docs/manual/core/indexes/index-types/)
- [Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)

- [Manage](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/)
- [Measure Use](https://www.mongodb.com/docs/manual/tutorial/measure-index-use/)
- [Strategies](https://www.mongodb.com/docs/manual/applications/indexes/)
- [Reference](https://www.mongodb.com/docs/manual/reference/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Docs Home](https://www.mongodb.com/docs/)
[Get Started](https://www.mongodb.com/docs/get-started/)
[Development](https://www.mongodb.com/docs/development/)
[Management](https://www.mongodb.com/docs/management/)
[Tools](https://www.mongodb.com/docs/tools-and-connectors/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)

- [Types](https://www.mongodb.com/docs/manual/core/indexes/index-types/)
- [Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)

- [Manage](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/)
- [Measure Use](https://www.mongodb.com/docs/manual/tutorial/measure-index-use/)
- [Strategies](https://www.mongodb.com/docs/manual/applications/indexes/)
- [Reference](https://www.mongodb.com/docs/manual/reference/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
[Overview](https://www.mongodb.com/docs/manual/)
[Documents](https://www.mongodb.com/docs/manual/core/document/)
[Databases & Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/)
[Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
[Indexes](https://www.mongodb.com/docs/manual/indexes/)
[Create](https://www.mongodb.com/docs/manual/core/indexes/create-index/)

[Drop](https://www.mongodb.com/docs/manual/core/indexes/drop-index/)
[Types](https://www.mongodb.com/docs/manual/core/indexes/index-types/)
[Properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/)
[Builds](https://www.mongodb.com/docs/manual/core/index-creation/)
[Rolling Index Builds](https://www.mongodb.com/docs/manual/core/rolling-index-builds/)
[Manage](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/)
[Measure Use](https://www.mongodb.com/docs/manual/tutorial/measure-index-use/)
[Strategies](https://www.mongodb.com/docs/manual/applications/indexes/)
[Reference](https://www.mongodb.com/docs/manual/reference/indexes/)
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
[Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
[Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
[Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
[Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
[In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
[Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
[Replication](https://www.mongodb.com/docs/manual/replication/)
[Sharding](https://www.mongodb.com/docs/manual/sharding/)
[Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
[Charts](https://www.mongodb.com/docs/charts/)
[Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Docs Home](https://www.mongodb.com/docs/)
[Development](https://www.mongodb.com/docs/development)
[Indexes](https://www.mongodb.com/docs/manual/indexes)
[Docs Home](https://www.mongodb.com/docs/)
[Development](https://www.mongodb.com/docs/development)
[Indexes](https://www.mongodb.com/docs/manual/indexes)
[Docs Home](https://www.mongodb.com/docs/)
[Development](https://www.mongodb.com/docs/development)
[Indexes](https://www.mongodb.com/docs/manual/indexes)

```
members[n].votes
```

```

```

Starting in MongoDB 7.1, index builds are improved with faster error reporting and increased failure resilience. You can also set the minimum available disk space required for index builds using the new [indexBuildMinAvailableDiskSpaceMB](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.indexBuildMinAvailableDiskSpaceMB) parameter, which stops index builds if disk space is too low.

```
indexBuildMinAvailableDiskSpaceMB
```

The following table compares the index build behavior starting in MongoDB 7.1 with earlier versions.
Index errors found during the collection scan phase, except duplicate key errors, are returned immediately and then the index build stops. Earlier MongoDB versions return errors in the commit phase, which occurs near the end of the index build. MongoDB 7.1 helps you to rapidly diagnose index errors. For example, if an incompatible index value format is found, the error is returned to you immediately.
Index build errors can take a long time to be returned compared to MongoDB 7.1 because the errors are returned near the end of the index build in the commit phase.
Increased resilience for your deployment. If an index build error occurs, a [secondary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-secondary) member can request that the [primary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-primary) member stop an index build and the secondary member does not crash. A request to stop an index build is not always possible: if a member has already voted to commit the index, then the secondary cannot request that the index build stop and the secondary crashes (similar to MongoDB 7.0 and earlier).
An index build error can cause a secondary member to crash.
Improved disk space management for index builds. An index build may be automatically stopped if the available disk space is below the minimum specified in the [indexBuildMinAvailableDiskSpaceMB](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.indexBuildMinAvailableDiskSpaceMB) parameter. If a member has already voted to commit the index, then the index build is not stopped.

```
indexBuildMinAvailableDiskSpaceMB
```

An index build is not stopped if there is insufficient available disk space.

Previous versions of MongoDB supported building indexes either in the foreground or background. Foreground index builds were fast and produced more efficient index data structures, but required blocking all read-write access to the parent database of the collection being indexed for the duration of the build. Background index builds were slower and had less efficient results, but allowed read-write access to the database and its collections during the build process.
Index builds now obtain an exclusive lock on only the collection being indexed during the start and end of the build process to protect metadata changes. The rest of the build process uses the yielding behavior of background index builds to maximize read-write access to the collection during the build. Index builds still produce efficient index data structures despite the more permissive locking behavior.
The optimized index build performance is at least on par with background index builds. For workloads with few or no updates received during the build process, optimized index builds can be as fast as a foreground index build on that same data.
Use [db.currentOp()](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/#mongodb-method-db.currentOp) to monitor the progress of ongoing index builds.

```
db.currentOp()
```

MongoDB ignores the background index build option if specified to [createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes) or its shell helpers [createIndex()](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/#mongodb-method-db.collection.createIndex) and [createIndexes().](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndexes/#mongodb-method-db.collection.createIndexes)

```
background
```

```
createIndexes
```

```
createIndex()
```

```
createIndexes()
```

For indexes that enforce constraints on the collection, such as [unique](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/index-unique/#std-label-index-type-unique) indexes, the mongod checks all pre-existing and concurrently-written documents for violations of those constraints after the index build completes. Documents that violate the index constraints can exist during the index build. If any documents violate the index constraints at the end of the build, the mongod terminates the build and throws an error.

```
mongod
```

```
mongod
```

For example, consider a populated collection inventory. An administrator wants to create a unique index on the product_sku field. If any documents in the collection have duplicate values for product_sku, the index build can still start successfully. If any violations still exist at the end of the build, the mongod terminates the build and throws an error.

```
inventory
```

```
product_sku
```

```
product_sku
```

```
mongod
```

Similarly, an application can successfully write documents to the inventory collection with duplicate values of product_sku while the index build is in progress. If any violations still exist at the end of the build, the mongod terminates the build and throws an error.

```
inventory
```

```
product_sku
```

```
mongod
```

To mitigate the risk of index build failure due to constraint violations:
- Validate that no documents in the collection violate the index
constraints.
- Stop all writes to the collection from applications that cannot
guarantee violation-free write operations.
Validate that no documents in the collection violate the index constraints.
Stop all writes to the collection from applications that cannot guarantee violation-free write operations.

#### https://www.mongodb.com/docs/manual/core/index-creation/#sharded-collectionsSharded Collections
For a sharded collection distributed across multiple shards, one or more shards may contain a chunk with duplicate documents. As such, the create index operation may succeed on some of the shards (i.e. the ones without duplicates) but not on others (i.e. the ones with duplicates). To avoid leaving inconsistent indexes across shards, you can issue the [db.collection.dropIndex()](https://www.mongodb.com/docs/manual/reference/method/db.collection.dropIndex/#mongodb-method-db.collection.dropIndex) from a [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) to drop the index from the collection.

```
db.collection.dropIndex()
```

```
mongos
```

To mitigate the risk of this occurrence, before creating the index:
- Validate that no documents in the collection violate the index
constraints.
- Stop all writes to the collection from applications that cannot
guarantee violation-free write operations.
Validate that no documents in the collection violate the index constraints.
Stop all writes to the collection from applications that cannot guarantee violation-free write operations.

[Index Consistency Checks for Sharded Collections](https://www.mongodb.com/docs/manual/core/index-creation/#std-label-index-creation-index-consistency)

By default, the server allows up to three concurrent index builds. To change the number of allowed concurrent index builds, modify the [maxNumActiveUserIndexBuilds](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxNumActiveUserIndexBuilds) parameter.

```
maxNumActiveUserIndexBuilds
```

If the number of concurrent index builds reaches the limit specified by maxNumActiveUserIndexBuilds, the server blocks additional index builds until the number of concurrent index builds drops below the limit.

```
maxNumActiveUserIndexBuilds
```

### https://www.mongodb.com/docs/manual/core/index-creation/#index-builds-during-write-heavy-workloadsIndex Builds During Write-Heavy Workloads
Building indexes during time periods where the target collection is under heavy write load can result in reduced write performance and longer index builds.
Consider designating a maintenance window during which applications stop or reduce write operations against the collection. Start the index build during this maintenance window to mitigate the potential negative impact of the build process.

### https://www.mongodb.com/docs/manual/core/index-creation/#insufficient-available-system-memory--ram-Insufficient Available System Memory (RAM)
[[[[createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes)](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes)](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes)](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes) supports building one or more indexes on a collection. createIndexes uses a combination of memory and temporary files on disk to build indexes. The default memory limit is 200 megabytes per createIndexes command, shared equally among all indexes built in that command. For example, if you build 10 indexes with one createIndexes command, MongoDB allocates each index 20 megabytes for the index build process when using the default memory limit of 200. When you reach the memory limit, MongoDB creates temporary files in the _tmp subdirectory within [--dbpath](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--dbpath) to complete the build.

```
createIndexes
```

```
createIndexes
```

```
createIndexes
```

```
createIndexes
```

```
_tmp
```

```
--dbpath
```

Adjust the memory limit with the [maxIndexBuildMemoryUsageMegabytes](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxIndexBuildMemoryUsageMegabytes) parameter. Increasing this parameter is only necessary in rare cases, such as when you run many simultaneous index builds with a single [createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes) command or when you index a data set larger than 500GB.

```
maxIndexBuildMemoryUsageMegabytes
```

```
createIndexes
```

Each [createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes) command has a limit of [maxIndexBuildMemoryUsageMegabytes](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxIndexBuildMemoryUsageMegabytes). When using the default [maxNumActiveUserIndexBuilds](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxNumActiveUserIndexBuilds) of 3, the total memory usage for all concurrent index builds can reach up to 3 times the value of [maxIndexBuildMemoryUsageMegabytes.](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxIndexBuildMemoryUsageMegabytes)

```
createIndexes
```

```
maxIndexBuildMemoryUsageMegabytes
```

```
maxNumActiveUserIndexBuilds
```

```
maxIndexBuildMemoryUsageMegabytes
```

If the host machine has limited available free RAM, you may need to schedule a maintenance period to increase the total system RAM before you can modify the mongod RAM usage.

```
mongod
```

Each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) in the replica set or sharded cluster must have [featureCompatibilityVersion](https://www.mongodb.com/docs/manual/reference/command/setFeatureCompatibilityVersion/#std-label-set-fcv) set to at least 4.4 to start index builds simultaneously across replica set members.

```
mongod
```

```
4.4
```

Index builds on a replica set or sharded cluster build simultaneously across all data-bearing replica set members. For sharded clusters, the index build occurs only on shards containing data for the collection being indexed. The primary requires a minimum number of data-bearing [voting](https://www.mongodb.com/docs/manual/reference/replica-configuration/#mongodb-rsconf-rsconf.members-n-.votes) members (i.e commit quorum), including itself, that must complete the build before marking the index as ready for use.

```
voting
```

If a data-bearing voting node becomes unreachable and the [commitQuorum](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#std-label-createIndexes-cmd-commitQuorum) is set to the default votingMembers, index builds can hang until that node comes back online.

```
votingMembers
```

The build process is summarized as follows:
1. The primary receives the [createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes) command and
immediately creates a "startIndexBuild" oplog entry associated with
the index build.
2. The secondaries start the index build after they replicate the
"startIndexBuild" oplog entry.
3. Each member "votes" to commit the build once it finishes indexing
data in the collection.
4. Secondary members continue to process any new write operations into
the index while waiting for the primary to confirm a quorum of votes.
5. When the primary has a quorum of votes, it checks for any key
constraint violations such as duplicate key errors.If there are no key constraint violations, the primary completes
the index build, marks the index as ready for use, and creates an
associated "commitIndexBuild" oplog entry.If there are any key constraint violations, the index build
fails. The primary aborts the index build and creates an
associated "abortIndexBuild" oplog entry.
6. If there are no key constraint violations, the primary completes
the index build, marks the index as ready for use, and creates an
associated "commitIndexBuild" oplog entry.
7. If there are any key constraint violations, the index build
fails. The primary aborts the index build and creates an
associated "abortIndexBuild" oplog entry.
8. The secondaries replicate the "commitIndexBuild" oplog entry and
complete the index build.If the secondaries instead replicate an "abortIndexBuild" oplog
entry, they abort the index build and discard the build job.
The primary receives the [createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes) command and immediately creates a "startIndexBuild" oplog entry associated with the index build.

```
createIndexes
```

The secondaries start the index build after they replicate the "startIndexBuild" oplog entry.
Each member "votes" to commit the build once it finishes indexing data in the collection.
Secondary members continue to process any new write operations into the index while waiting for the primary to confirm a quorum of votes.
When the primary has a quorum of votes, it checks for any key constraint violations such as duplicate key errors.
- If there are no key constraint violations, the primary completes
the index build, marks the index as ready for use, and creates an
associated "commitIndexBuild" oplog entry.
- If there are any key constraint violations, the index build
fails. The primary aborts the index build and creates an
associated "abortIndexBuild" oplog entry.
If there are no key constraint violations, the primary completes the index build, marks the index as ready for use, and creates an associated "commitIndexBuild" oplog entry.
If there are any key constraint violations, the index build fails. The primary aborts the index build and creates an associated "abortIndexBuild" oplog entry.
The secondaries replicate the "commitIndexBuild" oplog entry and complete the index build.
If the secondaries instead replicate an "abortIndexBuild" oplog entry, they abort the index build and discard the build job.
For sharded clusters, the index build occurs only on shards containing data for the collection being indexed.
For a more detailed description of the index build process, see [Index Build Process.](https://www.mongodb.com/docs/manual/core/index-creation/#std-label-index-build-process)

## Important
By default, index builds use a commit quorum of "votingMembers", or all data-bearing voting members. To start an index build with a non-default commit quorum, specify the [commitQuorum](https://www.mongodb.com/docs/manual/reference/command/[createIndexes](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#mongodb-dbcommand-dbcmd.createIndexes)/#std-label-createIndexes-cmd-commitQuorum) parameter to createIndexes or its shell helpers [db.collection.createIndex()](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/#mongodb-method-db.collection.createIndex) and [db.collection.createIndexes().](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndexes/#mongodb-method-db.collection.createIndexes)

```
"votingMembers"
```

```
createIndexes
```

```
db.collection.createIndex()
```

```
db.collection.createIndexes()
```

To modify the commit quorum required for an in-progress simultaneous index build, use the [setIndexCommitQuorum](https://www.mongodb.com/docs/manual/reference/command/setIndexCommitQuorum/#mongodb-dbcommand-dbcmd.setIndexCommitQuorum) command.

```
setIndexCommitQuorum
```

## Warning
Avoid performing rolling index and replicated index build processes concurrently as it might lead to unexpected issues, such as broken builds and crash loops.

## Note
Rolling index builds take at most one replica set member at a time, starting with the secondary members, and build the index on that member as a standalone. Rolling index builds require at least one replica set election. Rolling index builds should only be used if the customers meet the requirements listed on the [rolling index pages](https://www.mongodb.com/docs/manual/core/rolling-index-builds/#std-label-rolling-index-build) as the procedure lowers the resiliency of the cluster.

There are important differences between [commit quorums](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#std-label-createIndexes-cmd-commitQuorum) and [write concerns:](https://www.mongodb.com/docs/manual/reference/write-concern/#std-label-write-concern)
- Index builds use commit quorums.
- Write operations use write concerns.
Index builds use commit quorums.
Write operations use write concerns.
Each data-bearing node in a cluster is a voting member.
The commit quorum specifies how many data-bearing voting members, or which voting members, including the primary, must be prepared to commit a [simultaneous index build](https://www.mongodb.com/docs/manual/core/index-creation/#std-label-index-operations-simultaneous-build) before the primary will execute the commit.
The write concern is the level of acknowledgment that the write has propagated to the specified number of instances.
Changed in version 8.0: The commit quorum specifies how many nodes must be ready to finish the index build before the primary commits the index build. In contrast, when the primary has committed the index build, the write concern specifies how many nodes must replicate the index build oplog entry before the command returns success.
In previous releases, when the primary committed the index build, the write concern specified how many nodes must finish the index build before the command returned success.

### https://www.mongodb.com/docs/manual/core/index-creation/#interrupted-index-builds-on-a-primary-mongodInterrupted Index Builds on a Primary mongod
```
mongod
```

Starting in MongoDB 5.0, if the primary mongod performs a clean [shutdown](https://www.mongodb.com/docs/manual/reference/command/shutdown/#mongodb-dbcommand-dbcmd.shutdown) with "force" : true or receives a SIGTERM signal during an index build and the [commitQuorum](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#std-label-createIndexes-cmd-commitQuorum) is set to the default votingMembers, then the index build progress is saved to disk. The mongod automatically recovers the index build when it is restarted and continues from the saved checkpoint. In earlier versions, if the index build is interrupted, it has to be restarted from the beginning.

```
mongod
```

```
shutdown
```

```
"force" : true
```

```
SIGTERM
```

```
votingMembers
```

```
mongod
```

### https://www.mongodb.com/docs/manual/core/index-creation/#interrupted-index-builds-on-a-secondary-mongodInterrupted Index Builds on a Secondary mongod
```
mongod
```

Starting in MongoDB 5.0, if a secondary mongod performs a clean [shutdown](https://www.mongodb.com/docs/manual/reference/command/shutdown/#mongodb-dbcommand-dbcmd.shutdown) with "force" : true or receives a SIGTERM signal during an index build and the [commitQuorum](https://www.mongodb.com/docs/manual/reference/command/createIndexes/#std-label-createIndexes-cmd-commitQuorum) is set to the default votingMembers, then the index build progress is saved to disk. The mongod automatically recovers the index build when it is restarted and continues from the saved checkpoint. In earlier versions, if the index build is interrupted, it has to be restarted from the beginning.

```
mongod
```

```
shutdown
```

```
"force" : true
```

```
SIGTERM
```

```
votingMembers
```

```
mongod
```

The mongod can perform the startup process while the recovering index builds.

```
mongod
```

If you restart the mongod as a standalone (i.e. removing or commenting out [replication.replSetName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.replSetName) or omitting [--replSetName](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--replSet)), the mongod cannot restart the index build. The build remains in a paused state until it is manually [dropped.](https://www.mongodb.com/docs/manual/reference/command/dropIndexes/#mongodb-dbcommand-dbcmd.dropIndexes)

```
mongod
```

```
replication.replSetName
```

```
--replSetName
```

```
mongod
```

```
dropped
```

### https://www.mongodb.com/docs/manual/core/index-creation/#interrupted-index-builds-on-standalone-mongodInterrupted Index Builds on Standalone mongod
```
mongod
```

If the mongod shuts down during the index build, the index build job and all progress is lost. Restarting the mongod does not restart the index build. You must re-issue the [createIndex()](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/#mongodb-method-db.collection.createIndex) operation to restart the index build.

```
mongod
```

```
mongod
```

```
createIndex()
```

### https://www.mongodb.com/docs/manual/core/index-creation/#rollbacks-during-build-processRollbacks during Build Process
Starting in MongoDB 5.0, if a node is rolled back to a prior state during the index build, the index build progress is saved to disk. If there is still work to be done when the rollback concludes, the mongod automatically recovers the index build and continues from the saved checkpoint.

```
mongod
```

MongoDB can pause an in-progress index build to perform a [rollback.](https://www.mongodb.com/docs/manual/core/replica-set-rollbacks/#std-label-replica-set-rollbacks)
- If the rollback does not revert the index build, MongoDB restarts
the index build after completing the rollback.
- If the rollback reverts the index build, you must re-create the
index or indexes after the rollback completes.
If the rollback does not revert the index build, MongoDB restarts the index build after completing the rollback.
If the rollback reverts the index build, you must re-create the index or indexes after the rollback completes.

A sharded collection has an inconsistent index if the collection does not have the exact same indexes (including the index options) on each shard that contains chunks for the collection. Although inconsistent indexes should not occur during normal operations, inconsistent indexes can occur, such as:
- When a user is creating an index with a unique key constraint and
one shard contains a chunk with duplicate documents. In such cases,
the create index operation may succeed on the shards without
duplicates but not on the shard with duplicates.
- When a user is creating an index across the shards in a [rolling
manner (i.e. manually building the index one by one across the
shards)](https://www.mongodb.com/docs/manual/tutorial/build-indexes-on-sharded-clusters/) but either
fails to build the index for an associated shard or incorrectly
builds an index with different specification.
When a user is creating an index with a unique key constraint and one shard contains a chunk with duplicate documents. In such cases, the create index operation may succeed on the shards without duplicates but not on the shard with duplicates.

```
unique
```

When a user is creating an index across the shards in a [rolling manner (i.e. manually building the index one by one across the shards)](https://www.mongodb.com/docs/manual/tutorial/build-indexes-on-sharded-clusters/) but either fails to build the index for an associated shard or incorrectly builds an index with different specification.
The [config server](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server) primary periodically checks for index inconsistencies across the shards for sharded collections. To configure these periodic checks, see [enableShardedIndexConsistencyCheck](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.enableShardedIndexConsistencyCheck) and [shardedIndexConsistencyCheckIntervalMS.](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.shardedIndexConsistencyCheckIntervalMS)

```
enableShardedIndexConsistencyCheck
```

```
shardedIndexConsistencyCheckIntervalMS
```

The command [serverStatus](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-dbcommand-dbcmd.serverStatus) returns the field [shardedIndexConsistency](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.shardedIndexConsistency) to report on index inconsistencies when run on the config server primary.

```
serverStatus
```

```
shardedIndexConsistency
```

To check if a sharded collection has inconsistent indexes, see [Find Inconsistent Indexes Across Shards.](https://www.mongodb.com/docs/manual/tutorial/manage-indexes/#std-label-manage-indexes-find-inconsistent-indexes)

To see the status of an index build operation, you can use the [db.currentOp()](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/#mongodb-method-db.currentOp) method in [mongosh](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh). To filter the current operations for index creation operations, see [Active Indexing Operations](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/#std-label-currentOp-index-creation) for an example.

```
db.currentOp()
```

```
mongosh
```

The [msg](https://www.mongodb.com/docs/manual/reference/command/currentOp/#mongodb-data-currentOp.msg) field includes a percentage-complete measurement of the current stage in the index build process.

```
msg
```

While an index is being built, progress is written to the [MongoDB log](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-messages-ref). If an index build is stopped and resumed there will be log messages with fields like these:

```
```

```
```

Use the [dropIndexes](https://www.mongodb.com/docs/manual/reference/command/dropIndexes/#mongodb-dbcommand-dbcmd.dropIndexes) command or its shell helpers [dropIndex()](https://www.mongodb.com/docs/manual/reference/method/db.collection.dropIndex/#mongodb-method-db.collection.dropIndex) or [dropIndexes()](https://www.mongodb.com/docs/manual/reference/method/db.collection.dropIndexes/#mongodb-method-db.collection.dropIndexes) to terminate an in-progress index build. See [Stop In-Progress Index Builds](https://www.mongodb.com/docs/manual/reference/command/dropIndexes/#std-label-dropIndexes-cmd-index-builds) for more information.

```
dropIndexes
```

```
dropIndex()
```

```
dropIndexes()
```

Do not use [killOp](https://www.mongodb.com/docs/manual/reference/command/killOp/#mongodb-dbcommand-dbcmd.killOp) to terminate an in-progress index builds in replica sets or sharded clusters.

```
killOp
```

The following table describes each stage of the index build process:
Lock
The mongod obtains an exclusive X lock on the the collection being indexed. This blocks all read and write operations on the collection, including the application of any replicated write operations or metadata commands that target the collection. The mongod does not yield this lock.

```
mongod
```

```

```

```
mongod
```

Initialization
The mongod creates three data structures at this initial state:

```
mongod
```

- The initial index metadata entry.
- A temporary table ("side writes table") that stores keys
generated from writes to the collection being indexed
during the build process.
- A temporary table ("constraint violation table") for all
documents that may cause a key generation error. Key
generation errors occur when a document has invalid keys for the
indexed fields. For example, a document with duplicate field
values when building a [unique index](https://www.mongodb.com/docs/manual/core/index-unique/#std-label-index-type-unique)
or malformed [GeoJSON objects](https://www.mongodb.com/docs/manual/geospatial-queries/#std-label-geospatial-geojson) when
building a [2dsphere index.](https://www.mongodb.com/docs/manual/core/indexes/index-types/geospatial/2dsphere/#std-label-2dsphere-index)
The initial index metadata entry.
A temporary table ("side writes table") that stores keys generated from writes to the collection being indexed during the build process.
A temporary table ("constraint violation table") for all documents that may cause a key generation error. Key generation errors occur when a document has invalid keys for the indexed fields. For example, a document with duplicate field values when building a [unique index](https://www.mongodb.com/docs/manual/core/index-unique/#std-label-index-type-unique) or malformed [GeoJSON objects](https://www.mongodb.com/docs/manual/geospatial-queries/#std-label-geospatial-geojson) when building a [2dsphere index.](https://www.mongodb.com/docs/manual/core/indexes/index-types/geospatial/2dsphere/#std-label-2dsphere-index)
Lock
The mongod downgrades the exclusive X collection lock to an intent exclusive IX lock. The mongod periodically yields this lock to interleaving read and write operations.

```
mongod
```

```

```

```

```

```
mongod
```

Scan Collection
For each document in the collection, the mongod generates a key for that document and dumps the key into an external sorter.

```
mongod
```

If the mongod encounters a key generation error while generating a key during the collection scan, it stores that key in the constraint violation table for later processing.

```
mongod
```

If the mongod encounters any other error while generating a key, the build fails with an error.

```
mongod
```

Once the mongod completes the collection scan, it dumps the sorted keys into the index.

```
mongod
```

Process Side Writes Table
The mongod drains the side write table using first-in-first-out priority.

```
mongod
```

If the mongod encounters a key generation error while processing a key in the side write table, it stores that key in the constraint violation table for later processing.

```
mongod
```

If the mongod encounters any other error while processing a key, the build fails with an error.

```
mongod
```

For each document written to the collection during the build process, the mongod generates a key for that document and stores it in the side write table for later processing. The mongod uses a snapshot system to set a limit to the number of keys to process.

```
mongod
```

```
mongod
```

Vote and Wait for Commit Quorum
A mongod that is not part of a replica set skips this stage.

```
mongod
```

The mongod submits a "vote" to the primary to commit the index. Specifically, it writes the "vote" to an internal replicated collection on the [primary.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-primary)

```
mongod
```

If the mongod is the [primary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-primary), it waits until it has a commit quorum of votes (all voting data-bearing members by default) before continuing the index build process.

```
mongod
```

If the mongod is a [secondary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-secondary), it waits until it replicates either a "commitIndexBuild" or "abortIndexBuild" oplog entry:

```
mongod
```

- If the mongod replicates a "commitIndexBuild"

oplog entry, it finishes draining the side writes table and
moves to the next stage in the index build process.
- If the mongod replicates an "abortIndexBuild"
oplog entry, it aborts the index build and discards the build
job.
If the mongod replicates a "commitIndexBuild" oplog entry, it finishes draining the side writes table and moves to the next stage in the index build process.

```
mongod
```

If the mongod replicates an "abortIndexBuild" oplog entry, it aborts the index build and discards the build job.

```
mongod
```

While waiting for commit quorum, the mongod adds any additional keys generated from write operations to the collection being indexed to the side writes table and periodically drains the table.

```
mongod
```

Lock
The mongod upgrades the intent exclusive IX lock on the collection to a shared S lock. This blocks all write operations to the collection, including the application of any replicated write operations or metadata commands that target the collection.

```
mongod
```

```

```

```

```

Finish Processing Temporary Side Writes Table
The mongod continues draining remaining records in the side writes table. The mongod may pause replication during this stage.

```
mongod
```

```
mongod
```

If the mongod encounters a key generation error while processing a key in the side write table, it stores that key in the constraint violation table for later processing.

```
mongod
```

If the mongod encounters any other error while processing a key, the build fails with an error.

```
mongod
```

Lock
The mongod upgrades the shared S lock on the collection to an exclusive X lock on the collection. This blocks all read and write operations on the collection, including the application of any replicated write operations or metadata commands that target the collection. The mongod does not yield this lock.

```
mongod
```

```

```

```

```

```
mongod
```

Drop Side Write Table
The mongod applies any remaining operations in the side writes table before dropping it.

```
mongod
```

If the mongod encounters a key generation error while processing a key in the side write table, it stores that key in the constraint violation table for later processing.

```
mongod
```

If the mongod encounters any other error while processing a key, the build fails with an error.

```
mongod
```

At this point, the index includes all data written to the collection.
Process Constraint Violation Table
If the mongod is the [primary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-primary), it drains the constraint violation table using first-in-first-out priority.

```
mongod
```

- If no keys in the constraint violation table produce a key
generation error or if the table is empty, the
mongod drops the table and creates a
"commitIndexBuild" oplog entry. Secondaries can complete the
associated index build after replicating the oplog entry.
- If any key in the constraint violation table still produces a
key generation error, the mongod aborts the build
and throws an error. The mongod creates an
associated "abortIndexBuild" oplog entry to indicate that
secondaries should abort and discard the index build job.
If no keys in the constraint violation table produce a key generation error or if the table is empty, the mongod drops the table and creates a "commitIndexBuild" oplog entry. Secondaries can complete the associated index build after replicating the oplog entry.

```
mongod
```

If any key in the constraint violation table still produces a key generation error, the mongod aborts the build and throws an error. The mongod creates an associated "abortIndexBuild" oplog entry to indicate that secondaries should abort and discard the index build job.

```
mongod
```

```
mongod
```

If the mongod is a [secondary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-secondary), it drops the constraint violation table. Since the primary must successfully drain the constraint violation table prior to creating the "commitOplogEntry" oplog entry, the secondary can safely assume that no violations exist.

```
mongod
```

Mark the Index as Ready
The mongod updates the index metadata to mark the index as ready for use.

```
mongod
```

Lock
The mongod releases the X lock on the collection.

```
mongod
```

```

```

[FAQ: Concurrency](https://www.mongodb.com/docs/manual/faq/concurrency/)
Back
Sharded Collections
Next
Rolling Index Builds
On this page

- [Index Builds in Replicated Environments](https://www.mongodb.com/docs/manual/core/index-creation/#index-builds-in-replicated-environments)
- [Build Failure and Recovery](https://www.mongodb.com/docs/manual/core/index-creation/#build-failure-and-recovery)
- [Monitor In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#monitor-in-progress-index-builds)
- [Terminate In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#terminate-in-progress-index-builds)
- [Index Build Process](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-process)
[Behavior](https://www.mongodb.com/docs/manual/core/index-creation/#behavior)
[Index Build Impact on Database Performance](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-impact-on-database-performance)

[Index Builds in Replicated Environments](https://www.mongodb.com/docs/manual/core/index-creation/#index-builds-in-replicated-environments)
[Build Failure and Recovery](https://www.mongodb.com/docs/manual/core/index-creation/#build-failure-and-recovery)
[Monitor In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#monitor-in-progress-index-builds)
[Terminate In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#terminate-in-progress-index-builds)
[Index Build Process](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-process)
On this page
- [Behavior](https://www.mongodb.com/docs/manual/core/index-creation/#behavior)
- [Index Build Impact on Database Performance](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-impact-on-database-performance)
- [Index Builds in Replicated Environments](https://www.mongodb.com/docs/manual/core/index-creation/#index-builds-in-replicated-environments)
- [Build Failure and Recovery](https://www.mongodb.com/docs/manual/core/index-creation/#build-failure-and-recovery)
- [Monitor In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#monitor-in-progress-index-builds)
- [Terminate In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#terminate-in-progress-index-builds)
- [Index Build Process](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-process)
[Behavior](https://www.mongodb.com/docs/manual/core/index-creation/#behavior)
[Index Build Impact on Database Performance](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-impact-on-database-performance)
[Index Builds in Replicated Environments](https://www.mongodb.com/docs/manual/core/index-creation/#index-builds-in-replicated-environments)
[Build Failure and Recovery](https://www.mongodb.com/docs/manual/core/index-creation/#build-failure-and-recovery)
[Monitor In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#monitor-in-progress-index-builds)
[Terminate In Progress Index Builds](https://www.mongodb.com/docs/manual/core/index-creation/#terminate-in-progress-index-builds)
[Index Build Process](https://www.mongodb.com/docs/manual/core/index-creation/#index-build-process)


---

## 第三部分：数据库 Profiler (慢查询分析)

> 来源: https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/


# MongoDB 数据库 Profiler (官方)

> 来源: https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/

- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
- [Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)

- [Find Slow Queries](https://www.mongodb.com/docs/manual/tutorial/find-slow-queries-with-database-profiler/)

- [Block Slow Queries](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
- [Management](https://www.mongodb.com/docs/management/)
- [Tools](https://www.mongodb.com/docs/tools-and-connectors/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[Get Started](https://www.mongodb.com/docs/get-started/)
[Development](https://www.mongodb.com/docs/development/)

- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
- [Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)

- [Find Slow Queries](https://www.mongodb.com/docs/manual/tutorial/find-slow-queries-with-database-profiler/)

- [Block Slow Queries](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
[Overview](https://www.mongodb.com/docs/manual/)
[Documents](https://www.mongodb.com/docs/manual/core/document/)
[Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
[Insert](https://www.mongodb.com/docs/manual/tutorial/insert-documents/)
[Query](https://www.mongodb.com/docs/manual/tutorial/query-documents/)
[Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
[Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
[Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
[Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
[Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
[SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
[Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
[Text Search](https://www.mongodb.com/docs/manual/text-search/)
[Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
[Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
[Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)
[Atomicity & Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
[Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)
[Periods & Dollar Signs](https://www.mongodb.com/docs/manual/core/dot-dollar-considerations/)
[Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
[Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance/)
[Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
[Output](https://www.mongodb.com/docs/manual/reference/database-profiler/)
[Find Slow Queries](https://www.mongodb.com/docs/manual/tutorial/find-slow-queries-with-database-profiler/)
[Monitor Slow Queries](https://www.mongodb.com/docs/manual/tutorial/monitor-slow-queries/)
[Block Slow Queries](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/)
[Write Operation Performance](https://www.mongodb.com/docs/manual/core/write-performance/)

[Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
[Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
[Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
[Indexes](https://www.mongodb.com/docs/manual/indexes/)
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
[Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
[Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
[Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
[Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
[In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
[Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
[Replication](https://www.mongodb.com/docs/manual/replication/)
[Sharding](https://www.mongodb.com/docs/manual/sharding/)
[Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
[Charts](https://www.mongodb.com/docs/charts/)
[Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Management](https://www.mongodb.com/docs/management/)
[Tools](https://www.mongodb.com/docs/tools-and-connectors/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Docs Home](https://www.mongodb.com/docs/)
- [Get Started](https://www.mongodb.com/docs/get-started/)

- [Management](https://www.mongodb.com/docs/management/)
- [Tools](https://www.mongodb.com/docs/tools-and-connectors/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
- [Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)

- [Find Slow Queries](https://www.mongodb.com/docs/manual/tutorial/find-slow-queries-with-database-profiler/)

- [Block Slow Queries](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)

- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Docs Home](https://www.mongodb.com/docs/)
[Get Started](https://www.mongodb.com/docs/get-started/)
[Development](https://www.mongodb.com/docs/development/)
[Management](https://www.mongodb.com/docs/management/)
[Tools](https://www.mongodb.com/docs/tools-and-connectors/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Documents](https://www.mongodb.com/docs/manual/core/document/)

- Connect to Clusters
- [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
- [CRUD Operations](https://www.mongodb.com/docs/manual/crud/)

- [Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
- [Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
- [Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
- [SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
- [Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
- [Text Search](https://www.mongodb.com/docs/manual/text-search/)
- [Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
- [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
- [MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)

- [Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)

- [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
- [Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)

- [Find Slow Queries](https://www.mongodb.com/docs/manual/tutorial/find-slow-queries-with-database-profiler/)

- [Block Slow Queries](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/)

- [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
- [Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
- [Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
- [Indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
- [Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
- [Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
- [Replication](https://www.mongodb.com/docs/manual/replication/)
- [Sharding](https://www.mongodb.com/docs/manual/sharding/)
- [Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Charts](https://www.mongodb.com/docs/charts/)
- Reference
- [Support](https://www.mongodb.com/docs/manual/support/)
[Overview](https://www.mongodb.com/docs/manual/)
[Documents](https://www.mongodb.com/docs/manual/core/document/)
[Databases & Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/)
[Database Users](https://www.mongodb.com/docs/manual/reference/database-users/)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud/)
[Insert](https://www.mongodb.com/docs/manual/tutorial/insert-documents/)
[Query](https://www.mongodb.com/docs/manual/tutorial/query-documents/)
[Update](https://www.mongodb.com/docs/manual/tutorial/update-documents/)
[Remove](https://www.mongodb.com/docs/manual/tutorial/remove-documents/)
[Bulk Write](https://www.mongodb.com/docs/manual/core/bulk-write-operations/)

[Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
[Retryable Reads](https://www.mongodb.com/docs/manual/core/retryable-reads/)
[SQL to MongoDB](https://www.mongodb.com/docs/manual/reference/sql-comparison/)
[Natural Language to MongoDB](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/)
[Text Search](https://www.mongodb.com/docs/manual/text-search/)
[Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
[Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
[Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud/)
[Atomicity & Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
[Distributed Queries](https://www.mongodb.com/docs/manual/core/distributed-queries/)
[Periods & Dollar Signs](https://www.mongodb.com/docs/manual/core/dot-dollar-considerations/)
[Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
[Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization/)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance/)
[Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
[Database Profiler](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/)
[Output](https://www.mongodb.com/docs/manual/reference/database-profiler/)
[Find Slow Queries](https://www.mongodb.com/docs/manual/tutorial/find-slow-queries-with-database-profiler/)
[Monitor Slow Queries](https://www.mongodb.com/docs/manual/tutorial/monitor-slow-queries/)
[Block Slow Queries](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/)
[Write Operation Performance](https://www.mongodb.com/docs/manual/core/write-performance/)
[Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
[Query Shapes](https://www.mongodb.com/docs/manual/core/query-shapes/)
[Cursors](https://www.mongodb.com/docs/manual/core/cursors/)
[Indexes](https://www.mongodb.com/docs/manual/indexes/)
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
[Aggregation Operations](https://www.mongodb.com/docs/manual/aggregation/)
[Time Series](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
[Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
[Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
[In-Use Encryption](https://www.mongodb.com/docs/manual/core/security-in-use-encryption/)
[Development Checklist](https://www.mongodb.com/docs/manual/administration/production-checklist-development/)
[Replication](https://www.mongodb.com/docs/manual/replication/)
[Sharding](https://www.mongodb.com/docs/manual/sharding/)
[Performance](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
[Charts](https://www.mongodb.com/docs/charts/)
[Support](https://www.mongodb.com/docs/manual/support/)
- [AI Models](https://www.mongodb.com/docs/voyageai/)
[AI Models](https://www.mongodb.com/docs/voyageai/)
- [Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)
[Server Release Notes](https://www.mongodb.com/docs/manual/release-notes/)

[Docs Home](https://www.mongodb.com/docs/)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance)
[Docs Home](https://www.mongodb.com/docs/)
[Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance)
[Docs Home](https://www.mongodb.com/docs/)
[Development](https://www.mongodb.com/docs/development)
[CRUD Operations](https://www.mongodb.com/docs/manual/crud)
[MongoDB CRUD Concepts](https://www.mongodb.com/docs/manual/core/crud)
[Query Optimization](https://www.mongodb.com/docs/manual/core/query-optimization)
[Analyze Query Performance](https://www.mongodb.com/docs/manual/tutorial/evaluate-operation-performance)

The database profiler can degrade MongoDB performance. Before enabling the database profiler, consider using one of the following alternatives:

```
$queryStats
```

To learn more about the performance impact of the database profiler, see [Profiler Overhead.](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-overhead)
The database profiler collects detailed information about [Database Commands](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/command/#std-label-database-commands) executed against a running mongod instance, including CRUD operations and administration commands.

```
mongod
```

The profiler writes data to the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection, a [capped collection](https://www.mongodb.com/docs/manual/core/capped-collections/#std-label-manual-capped-collection) in each profiled database. See [Database Profiler Output](https://www.mongodb.com/docs/manual/reference/database-profiler/) for an overview of the documents the profiler creates.

```
system.profile
```

## Warning
The profiler is off by default. You can enable it per-database or per-instance at one of several [profiling levels](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-level). When enabled, profiling affects database performance and disk use. See [Database Profiler Overhead.](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-overhead)

```
off
```

This page documents important database profiler administration options. For additional information, see:
- [Database Profiler Output](https://www.mongodb.com/docs/manual/reference/database-profiler/#std-label-profiler)
- [Profile Command](https://www.mongodb.com/docs/manual/reference/command/profile/#std-label-profile-command)
- [db.currentOp()](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/#mongodb-method-db.currentOp)
[Database Profiler Output](https://www.mongodb.com/docs/manual/reference/database-profiler/#std-label-profiler)
[Profile Command](https://www.mongodb.com/docs/manual/reference/command/profile/#std-label-profile-command)
[db.currentOp()](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/#mongodb-method-db.currentOp)

```
db.currentOp()
```

## https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiling-levelsProfiling Levels
The following profiling levels are available:

```

```

```

```

The profiler collects data for operations that exceed the slowms threshold or match a specified [filter.](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-filter)

```
slowms
```

When a filter is set:
- The slowms and sampleRate options are not used for
profiling.
- The profiler only captures operations that match the
[filter.](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-filter)
The slowms and sampleRate options are not used for profiling.

```
slowms
```

```
sampleRate
```

The profiler only captures operations that match the [filter.](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-filter)

```

```

The profiler collects data for all operations.
When set to level 2, the profiler ignores user provided values for slowms and filter.

```

```

```
slowms
```

```
filter
```

You can enable database profiling for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances.

```
mongod
```

To enable profiling, use one of the following methods:
- To enable profiling at startup, set [operationProfiling.mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.mode)
in your [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)
- To enable profiling during runtime, use the [mongosh](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)
helper method [db.setProfilingLevel().](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel)
To enable profiling at startup, set [operationProfiling.mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.mode) in your [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)

```
operationProfiling.mode
```

To enable profiling during runtime, use the [mongosh](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh) helper method [db.setProfilingLevel().](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel)

```
mongosh
```

```
db.setProfilingLevel()
```

MongoDB creates the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection in a database after you enable profiling for that database. The profiler uses this collection to record data.

```
system.profile
```

To enable profiling for a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance at startup, set [operationProfiling.mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.mode) in your [configuration file](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options) to your preferred logging level.

```
mongod
```

```
operationProfiling.mode
```

To enable profiling for all operations on the currently connected database, run in [mongosh:](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)

```
mongosh
```

```
```

```
```

The shell returns the previous profiling level in was and sets the new level. "ok" : 1 indicates success:

```
was
```

```
"ok" : 1
```

```
{ "was" : 0, "slowms" : 100, "sampleRate" : 1.0, "ok" : 1 }
```

```
{ "was" : 0, "slowms" : 100, "sampleRate" : 1.0, "ok" : 1 }
```

To verify the new setting, see the [Check Profiling Level](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-view-status) section.
Starting in MongoDB 5.0, changes made to the [database [profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile)r](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiler) level, slowms, sampleRate, or filter using the profile command or [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) wrapper method are recorded in the [log file.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--logpath)

```
level
```

```
slowms
```

```
sampleRate
```

```
filter
```

```
profile
```

```
db.setProfilingLevel()
```

```
log file
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#global-and-per-database-profiling-settingsGlobal and Per-Database Profiling Settings
[slowms](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-slowms) and [sampleRate](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-sampleRate) are global settings that affect all databases in the process.
[Profiling level](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-[profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile)r/#std-label-database-profiling-level) and [filter](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-filter) are database-level settings when set with profile or [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel). When set as command-line or [configuration file](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options) options, they affect the entire process.

```
profile
```

```
db.setProfilingLevel()
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#specify-the-threshold-for-slow-operationsSpecify the Threshold for Slow Operations
By default, the slow operation threshold is 100 milliseconds.
Slow operations are logged based on workingMillis, which is the amount of time that MongoDB spends working on that operation. This means that factors such as waiting for locks and flow control do not affect whether an operation exceeds the slow operation threshold.

```
workingMillis
```

To change the slow operation threshold, use one of the following:
- Set the value of slowms using the [profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile) command or
[db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) shell helper method.
- Set the value of [--slowms](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--slowms) from the command line at startup.
- Set the value of [slowOpThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpThresholdMs) in a
[configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)
Set the value of slowms using the [profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile) command or [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) shell helper method.

```
slowms
```

```
profile
```

```
db.setProfilingLevel()
```

Set the value of [--slowms](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--slowms) from the command line at startup.

```
--slowms
```

Set the value of [slowOpThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpThresholdMs) in a [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)

```
slowOpThresholdMs
```

The following example sets the profiling level for the currently connected database to 1 and sets the slow operation threshold for the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance to 20 milliseconds:

```

```

```
mongod
```

```

```

```
db.setProfilingLevel( 1, { slowms: 20 } )
```

```
db.setProfilingLevel( 1, { slowms: 20 } )
```

A profiling level of 1 causes the profiler to record operations slower than the slowms threshold.

```

```

```
slowms
```

The slow operation threshold applies to all databases in a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance. It is used by both the database profiler and the diagnostic log. Set it to the highest useful value to avoid performance degradation.

```
mongod
```

For [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), use [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) to configure slowms and sampleRate. These settings affect only the diagnostic log on mongos, not the profiler. Profiling is not available on mongos. [[1]](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#footnote-mongos-systemlog)

```
mongos
```

```
db.setProfilingLevel()
```

```
slowms
```

```
sampleRate
```

```
mongos
```

```
mongos
```

The following example sets a [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance's slow operation threshold for logging slow operations to 20:

```
mongos
```

```

```

```
db.setProfilingLevel( 0, { slowms: 20 } )
```

```
db.setProfilingLevel( 0, { slowms: 20 } )
```

The [profiler entries](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiler) and the [diagnostic log messages (i.e. mongod/mongos logmessages)](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-message-slow-ops) for read/write operations include:
- planCacheShapeHash to help identify slow queries with the same
[plan cache query shape.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-plan-cache-query-shape)Starting in MongoDB 8.0, the existing queryHash field is duplicated
in a new field named planCacheShapeHash. If you're using an earlier
MongoDB version, you'll only see the queryHash field. Future MongoDB
versions will remove the deprecated queryHash field, and you'll need
to use the planCacheShapeHash field instead.
- planCacheKey to provide more insight into the [query plan
cache](https://www.mongodb.com/docs/manual/core/query-plans/) for slow queries.
planCacheShapeHash to help identify slow queries with the same [plan cache query shape.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-plan-cache-query-shape)

```
planCacheShapeHash
```

Starting in MongoDB 8.0, the existing queryHash field is duplicated in a new field named planCacheShapeHash. If you're using an earlier MongoDB version, you'll only see the queryHash field. Future MongoDB versions will remove the deprecated queryHash field, and you'll need to use the planCacheShapeHash field instead.

```
queryHash
```

```
planCacheShapeHash
```

```
queryHash
```

```
queryHash
```

```
planCacheShapeHash
```

planCacheKey to provide more insight into the [query plan cache](https://www.mongodb.com/docs/manual/core/query-plans/) for slow queries.

```
planCacheKey
```

Secondary members of a replica set now [log oplog entries](https://www.mongodb.com/docs/manual/core/replica-set-oplog/#std-label-slow-oplog-application) that take longer than the slow operation threshold to apply. These slow oplog messages:
- Are logged for the secondaries in the
[diagnostic log.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--logpath)
- Are logged under the [REPL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REPL) component with the text
applied op: <oplog entry> took <num>ms.
- Do not depend on the log levels (either at the system or component
level)
- Do not depend on the profiling level.
- Are affected by [slowOpSampleRate.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)
Are logged for the secondaries in the [diagnostic log.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--logpath)

```
diagnostic log
```

Are logged under the [REPL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REPL) component with the text applied op: <oplog entry> took <num>ms.

```
REPL
```

```
applied op: <oplog entry> took <num>ms
```

Do not depend on the log levels (either at the system or component level)
Do not depend on the profiling level.
Are affected by [slowOpSampleRate.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)

```
slowOpSampleRate
```

The profiler does not capture slow oplog entries.

To profile only a randomly sampled subset of slow operations, set sampleRate in one of the following ways: [[2]](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#footnote-slow-oplogs)

```
sampleRate
```

- Set the value of sampleRate using the [profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile) command
or [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) shell helper method.
- Set the value of [[--slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/program/[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)/#std-option-mongos.--slowOpSampleRate)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongod/#std-option-mongod.--slowOpSampleRate)
for mongod or --slowOpSampleRate
for mongos from the command line at startup.
- Set the value of [slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate) in a
[configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)
Set the value of sampleRate using the [profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile) command or [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) shell helper method.

```
sampleRate
```

```
profile
```

```
db.setProfilingLevel()
```

Set the value of [[--slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/program/[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)/#std-option-mongos.--slowOpSampleRate)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongod/#std-option-mongod.--slowOpSampleRate) for mongod or --slowOpSampleRate for mongos from the command line at startup.

```
--slowOpSampleRate
```

```
mongod
```

```
--slowOpSampleRate
```

```
mongos
```

Set the value of [slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate) in a [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)

```
slowOpSampleRate
```

By default, sampleRate is set to 1.0, meaning all slow operations are profiled. When sampleRate is set between 0 and 1, databases with a profiling level 1 only profile a randomly sampled percentage of slow operations based on sampleRate.

```
sampleRate
```

```
1.0
```

```
sampleRate
```

```

```

```

```

```

```

```
sampleRate
```

The following example sets the profiling level to 1 and sets the profiles to sample 42% of slow operations:

```

```

```
db.setProfilingLevel( 1, { sampleRate: 0.42 } )
```

```
db.setProfilingLevel( 1, { sampleRate: 0.42 } )
```

The modified sample rate value also applies to the system log.
For [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), slowms and sampleRate affect only the diagnostic log, not the profiler. [[1]](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#footnote-mongos-systemlog) To set the sampling rate for mongos logging:

```
mongos
```

```
slowms
```

```
sampleRate
```

```
mongos
```

```
db.setProfilingLevel( 0, { sampleRate: 0.42 } )
```

```
db.setProfilingLevel( 0, { sampleRate: 0.42 } )
```

When [logLevel](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.logLevel) is set to 0, MongoDB records slow operations to the diagnostic log at a rate determined by [slowOpSampleRate.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)

```
logLevel
```

```

```

```
slowOpSampleRate
```

At higher [[logLevel](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.logLevel)](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.logLevel) settings, all operations appear in the diagnostic log regardless of their latency with the following exception: the logging of slow oplog entry messages by the secondaries. The secondaries log only the slow oplog entries; increasing the logLevel does not log all oplog entries.

```
logLevel
```

```
logLevel
```

[1](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#ref-mongos-systemlog-id1)
[2](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#ref-mongos-systemlog-id3)
[Database Profiling and Sharding.](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-db-profiling-sharding)

To control which operations are profiled and logged, set a filter in one of the following ways:
- [profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile) command or [db.setProfilingLevel().](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel)
- [filter](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.filter) in a [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)
[profile](https://www.mongodb.com/docs/manual/reference/command/profile/#mongodb-dbcommand-dbcmd.profile) command or [db.setProfilingLevel().](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel)

```
profile
```

```
db.setProfilingLevel()
```

[filter](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.filter) in a [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)

```
filter
```

For [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod), filter affects both the diagnostic log and the profiler, if enabled. For [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), filter affects the diagnostic log only.

```
mongod
```

```
filter
```

```
mongos
```

```
filter
```

When a profiling filter is set, the [slowms](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-slowms) and [sampleRate](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#std-label-set-profiling-level-options-sampleRate) options do not affect the diagnostic log or the profiler.

```
filter
```

The following example sets profiling level 1 with a filter that logs only query operations taking longer than 2 seconds:

```

```

```
query
```

```
db.setProfilingLevel( 1, { filter: { op: "query", millis: { $gt: 2000 } } } )
```

```
db.setProfilingLevel( 1, { filter: { op: "query", millis: { $gt: 2000 } } } )
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#check-profiling-levelCheck Profiling Level
To view the [profiling level](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-levels), run in [mongosh:](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)

```
mongosh
```

```
db.getProfilingStatus()
```

```
db.getProfilingStatus()
```

The shell returns a document similar to the following:

```
{ "was" : 0, "slowms" : 100, "sampleRate" : 1.0, "ok" : 1 }
```

```
{ "was" : 0, "slowms" : 100, "sampleRate" : 1.0, "ok" : 1 }
```

The returned document contains:
- was: current profiling level.
- slowms: operation time threshold in milliseconds.
- sampleRate: percentage of slow operations being profiled.
was: current profiling level.

```
was
```

slowms: operation time threshold in milliseconds.

```
slowms
```

sampleRate: percentage of slow operations being profiled.

```
sampleRate
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#disable-profilingDisable Profiling
To disable profiling, run in [mongosh:](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)

```
mongosh
```

```
db.setProfilingLevel(0)
```

```
db.setProfilingLevel(0)
```

Disabling profiling can improve database performance and lower disk use. For more information, see [Database Profiler Overhead](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-overhead) .

```
mongod
```

For development and test environments, you can enable profiling for an entire [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance. The profiling level applies to all databases on that instance.

```
mongod
```

Pass the following options to [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) at startup:

```
mongod
```

```
mongod --profile 1 --slowms 15 --slowOpSampleRate 0.5
```

```
mongod --profile 1 --slowms 15 --slowOpSampleRate 0.5
```

Alternatively, specify [operationProfiling](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-operation-profiling-configuration-options) in the [configuration file.](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options)
This sets profiling level 1, defines slow operations as those lasting longer than 15 milliseconds, and profiles 50% of slow operations. [[2]](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#footnote-slow-oplogs)

```

```

```

```

slowms and slowOpSampleRate also affect operations recorded in the diagnostic log when [logLevel](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.logLevel) is 0. Both settings also configure diagnostic logging for [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos). [[2]](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#footnote-slow-oplogs)

```
slowms
```

```
slowOpSampleRate
```

```
logLevel
```

```

```

```
mongos
```

- [mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.mode)
- [slowOpThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpThresholdMs)
- [slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)
[mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.mode)

```
mode
```

[slowOpThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpThresholdMs)

```
slowOpThresholdMs
```

[slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)

```
slowOpSampleRate
```

You cannot enable profiling on a [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance. To enable profiling in a sharded cluster, enable it on each mongod instance in the cluster.

```
mongos
```

```
mongod
```

You can set [--slowms](https://www.mongodb.com/docs/manual/reference/program/[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)/#std-option-mongos.--slowms) and [slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/program/mongos/#std-option-mongos.--slowOpSampleRate) on mongos to configure the diagnostic log for slow operations.

```
--slowms
```

```
slowOpSampleRate
```

```
mongos
```

The profiler logs database operations to the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection. Query that collection to view profiling data. For example queries, see [Example Profiler Data Queries](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-example-queries). For output details, see [Database Profiler Output.](https://www.mongodb.com/docs/manual/reference/database-profiler/)

```
system.profile
```

You cannot perform any operation, including reads, on the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection from within a [transaction.](https://www.mongodb.com/docs/manual/core/transactions/#std-label-transactions)

```
system.profile
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#example-profiler-data-queriesExample Profiler Data Queries
This section shows example queries on the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection. For query output details, see [Database Profiler Output.](https://www.mongodb.com/docs/manual/reference/database-profiler/)

```
system.profile
```

Return the most recent 10 log entries:

```
db.system.profile.find().limit(10).sort( { ts : -1 } ).pretty()
```

```
db.system.profile.find().limit(10).sort( { ts : -1 } ).pretty()
```

Return all operations except command operations ([$cmd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term--cmd)):

```
db.system.profile.find( { op: { $ne : 'command' } } ).pretty()
```

```
db.system.profile.find( { op: { $ne : 'command' } } ).pretty()
```

Return operations for a specific collection (this example uses mydb.test):

```
mydb.test
```

```
db.system.profile.find( { ns : 'mydb.test' } ).pretty()
```

```
db.system.profile.find( { ns : 'mydb.test' } ).pretty()
```

Return operations taking longer than 5 milliseconds:

```
db.system.profile.find( { millis : { $gt : 5 } } ).pretty()
```

```
db.system.profile.find( { millis : { $gt : 5 } } ).pretty()
```

Return operations in a specific time range:

```
db.system.profile.find( { ts : { $gt: new ISODate("2012-12-09T03:00:00Z"), $lt: new ISODate("2012-12-09T03:40:00Z") }} ).pretty()
```

```
db.system.profile.find( { ts : { $gt: new ISODate("2012-12-09T03:00:00Z"), $lt: new ISODate("2012-12-09T03:40:00Z") }} ).pretty()
```

Return operations in a time range, exclude the user field, and sort by duration:

```
user
```

```
db.system.profile.find( { ts : { $gt: new ISODate("2011-07-12T03:00:00Z"), $lt: new ISODate("2011-07-12T03:40:00Z") }}, { user: 0 } ).sort( { millis: -1 } )
```

```
db.system.profile.find( { ts : { $gt: new ISODate("2011-07-12T03:00:00Z"), $lt: new ISODate("2011-07-12T03:40:00Z") }}, { user: 0 } ).sort( { millis: -1 } )
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#show-the-five-most-recent-eventsShow the Five Most Recent Events
On a database that has profiling enabled, the show profile helper in [mongosh](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh) displays the 5 most recent operations that took at least 1 millisecond to execute. Run show profile from [mongosh:](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)

```
show profile
```

```
mongosh
```

```
show profile
```

```
mongosh
```

```
show profile
```

```
show profile
```

## https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiler-overheadProfiler Overhead
When enabled, profiling affects database performance, especially at [profiling level](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-level) 2 or when using a low [slowms threshold](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-specify-slowms-threshold) with level 1. Profiling also uses disk space, because it writes to the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection and the MongoDB [logfile.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--logpath)

```

```

```

```

```
system.profile
```

```
logfile
```

## Warning
Consider performance and storage implications before you enable the profiler in a production deployment.

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#the-system.profile-collectionThe system.profile Collection
```
system.profile
```

The [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection is a [capped collection](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-capped-collection) with a default size of 1 megabyte, which can typically store several thousand profile documents. If you need to change the size, follow the steps below.

```
system.profile
```

### https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#change-size-of-system.profile-collection-on-the-primaryChange Size of system.profile Collection on the Primary
```
system.profile
```

To change the size of the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection on the [primary:](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-primary)

```
system.profile
```

1. Disable profiling.
2. Drop the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile)
collection.
3. Create a new [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile)
collection.
4. Re-enable profiling.
Disable profiling.
Drop the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection.

```
system.profile
```

Create a new [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection.

```
system.profile
```

Re-enable profiling.
For example, to create a new [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection of 4000000 bytes (4 MB) in [mongosh:](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)

```
system.profile
```

```
4000000
```

```
mongosh
```

```
```

```
```

```
system.profile
```

To change the size of the [system.profile](https://www.mongodb.com/docs/manual/reference/system-collections/#mongodb-data--database-.system.profile) collection on a [secondary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-secondary), stop the secondary, run it as a standalone, and perform the steps above. Then, restart it as a replica set member. For more information, see [Perform Maintenance on Self-Managed Replica Set Members.](https://www.mongodb.com/docs/manual/tutorial/perform-maintence-on-replica-set-members/)

```
system.profile
```

[1](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#ref-slow-oplogs-id2)
[2](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#ref-slow-oplogs-id4)
[3](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#ref-slow-oplogs-id5)
[log oplog entries](https://www.mongodb.com/docs/manual/core/replica-set-oplog/#std-label-slow-oplog-application)
- Are logged for the secondaries in the
[diagnostic log.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--logpath)
- Are logged under the [REPL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REPL) component with the text
applied op: <oplog entry> took <num>ms.
- Do not depend on the log levels (either at the system or component
level)
- Do not depend on the profiling level.
- Are affected by [slowOpSampleRate.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)
[diagnostic log.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--logpath)

```
diagnostic log
```

[REPL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REPL)

```
REPL
```

```
applied op: <oplog entry> took <num>ms
```

[slowOpSampleRate.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate)

```
slowOpSampleRate
```

Back
Explain Slow Queries
Next
Output
On this page

- [View Profiler Data](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#view-profiler-data)
- [Profiler Overhead](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiler-overhead)
[Profiling Levels](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiling-levels)
[Enable and Configure Database Profiling](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#enable-and-configure-database-profiling)
[View Profiler Data](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#view-profiler-data)
[Profiler Overhead](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiler-overhead)
On this page
- [Profiling Levels](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiling-levels)

- [Enable and Configure Database Profiling](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#enable-and-configure-database-profiling)
- [View Profiler Data](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#view-profiler-data)
- [Profiler Overhead](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiler-overhead)
[Profiling Levels](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiling-levels)
[Enable and Configure Database Profiling](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#enable-and-configure-database-profiling)
[View Profiler Data](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#view-profiler-data)
[Profiler Overhead](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#profiler-overhead)


---

### 性能分析补充


# MongoDB 性能分析与火焰图方法论

## perf 工具采集流程

perf 是 Linux 内核自带的性能分析工具，可以采集进程的 CPU 调用栈热点。

### 基础采集命令
```bash
# 采集 mongod 进程 10 秒的 CPU 调用栈（采样频率 99Hz）
perf record -F 99 -p $(pgrep mongod) -g -- sleep 10

# 生成文本格式的调用栈
perf script > perf.stacks

# 折叠堆栈并生成火焰图 SVG
stackcollapse-perf.pl perf.stacks | flamegraph.pl > flamegraph.svg
```

### 采样频率选择
- 99Hz：标准采样频率，约 3% CPU 额外开销
- 199Hz：高精度采样，约 5% 额外开销
- 49Hz：低开销采样，适合生产环境长时间监控

## 常见 MongoDB 热点函数解读

### 1. __wt_cache_evict_server / __wt_spin_lock
**含义**：WiredTiger 缓存驱逐线程在自旋等待
**根因**：脏页比例超过 eviction_target 水位，驱逐线程忙不过来
**修复**：
```javascript
db.adminCommand({
  setParameter: 1,
  wiredTigerEngineRuntimeConfig: "eviction=(threads_max=4),eviction_target=80"
})
```

### 2. __wt_txn_checkpoint / __os_file_write
**含义**：Checkpoint 期间大量同步 IO 写入
**根因**：Checkpoint 间隔太短或 journal 太大
**修复**：调整 `storage.wiredTiger.engineConfig.checkpointSizeMB`

### 3. SSL_do_handshake / __pthread_mutex_lock
**含义**：TLS 握手的互斥锁竞争
**根因**：短连接风暴导致频繁的 TLS 握手
**修复**：应用层启用连接池复用

### 4. BtreeCursor::advance / __wt_page_in_func
**含义**：B-tree 游标推进时频繁缺页
**根因**：缺少索引导致集合扫描
**修复**：通过 explain() 分析查询计划并添加索引

## Off-CPU 分析

除了 CPU 热点，Off-CPU 分析可以发现阻塞在 IO、锁等待上的时间：
```bash
# 使用 bcc/BPF 工具
offcputime-bpfcc -p $(pgrep mongod) 10 > offcpu.stacks
```

## 参考来源
- Brendan Gregg's Flame Graphs: https://www.brendangregg.com/flamegraphs.html
- perf Examples: https://www.brendangregg.com/perf.html
- MongoDB Performance Troubleshooting: https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/

