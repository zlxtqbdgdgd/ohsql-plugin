---
source: https://www.mongodb.com/docs/manual/reference/configuration-options/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "Self-Managed Configuration File Options - Database Manual - MongoDB Docs"
last_verified: 2026-04-11
---

# MongoDB 配置文件参数参考 (官方)

> 来源: https://www.mongodb.com/docs/manual/reference/configuration-options/

## Note
YAML does not support tab characters for indentation: use spaces instead.

```
```

```
```

The Linux package init scripts included in the official MongoDB packages depend on specific values for [systemLog.path](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.path), [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath), and [processManagement.fork](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.fork) or MONGODB_CONFIG_OVERRIDE_NOFORK system environment variable. If you modify these settings in the default configuration file, mongod may not start.

```
systemLog.path
```

```
storage.dbPath
```

```
processManagement.fork
```

```
MONGODB_CONFIG_OVERRIDE_NOFORK
```

```
mongod
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#externally-sourced-valuesExternally Sourced Values

## Note
MongoDB supports using [expansion directives](https://www.mongodb.com/docs/manual/reference/expansion-directives/#std-label-expansion-directives) in configuration files to load externally sourced values. Expansion directives can load values for specific [configuration file options](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options) or load the entire configuration file.
The following expansion directives are available:
- __rest

```
__rest
```

Allows users to specify a REST endpoint as the external source for configuration file options or the full configuration file.

```
REST
```

If the configuration file includes the [__rest](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/expansion-directives/#mongodb-configexpansion-configexpansion.__rest) expansion, on Linux/macOS, the read access to the configuration file must be limited to the user running the mongod / [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) process only.

```
__rest
```

```
mongod
```

```
mongos
```

- __exec

```
__exec
```

Allows users to specify a shell or terminal command as the external source for configuration file options or the full configuration file.
If the configuration file includes the [__exec](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/expansion-directives/#mongodb-configexpansion-configexpansion.__exec) expansion, on Linux/macOS, the write access to the configuration file must be limited to the user running the mongod / [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) process only.

```
__exec
```

```
mongod
```

```
mongos
```

For complete documentation, see [External Configuration Values for Self-Managed MongoDB.](https://www.mongodb.com/docs/manual/reference/expansion-directives/#std-label-externally-sourced-values)

To configure [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using a config file, specify the config file with the --config option or the -f option, as in the following examples:

```
mongod
```

```
mongos
```

```
--config
```

```

```

For example, the following uses [mongod --config <configuration file>](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--config) [mongos --config <configuration file>:](https://www.mongodb.com/docs/manual/reference/program/mongos/#std-option-mongos.--config)

```
mongod --config <configuration file>
```

```
mongos --config <configuration file>
```

```
```

```
```

You can also use the -f alias to specify the configuration file, as in the following:

```

```

```
mongod -f /etc/mongod.confmongos -f /etc/mongos.conf
```

```
mongod -f /etc/mongod.confmongos -f /etc/mongos.conf
```

If you installed from a package and have started MongoDB using your system's [init script](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-init-script), you are already using a configuration file.

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#expansion-directives-and---configexpandExpansion Directives and --configExpand

```
--configExpand
```

If you are using [expansion directives](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/expansion-directives/#std-label-expansion-directives) in the configuration file, you must include the [--configExpand](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--configExpand) option when starting the mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos). For example:

```
--configExpand
```

```
mongod
```

```
mongos
```

```
mongod --config /etc/mongod.conf --configExpand "rest,exec"mongos --config /etc/mongos.conf --configExpand "rest,exec"
```

```
mongod --config /etc/mongod.conf --configExpand "rest,exec"mongos --config /etc/mongos.conf --configExpand "rest,exec"
```

If the configuration file includes an expansion directive and you start the [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) / [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) without specifying that directive in the [--configExpand](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--configExpand) option, the mongod / mongos fails to start.

```
mongod
```

```
mongos
```

```
--configExpand
```

```
mongod
```

```
mongos
```

For complete documentation, see [External Configuration Values for Self-Managed MongoDB.](https://www.mongodb.com/docs/manual/reference/expansion-directives/#std-label-externally-sourced-values)

```
systemLog
```

```
systemLog: verbosity: <int> quiet: <boolean> traceAllExceptions: <boolean> syslogFacility: <string> path: <string> logAppend: <boolean> logRotate: <string> destination: <string> timeStampFormat: <string> component: accessControl: verbosity: <int> command: verbosity: <int> # COMMENT additional component verbosity settings omitted for brevity
```

```
systemLog: verbosity: <int> quiet: <boolean> traceAllExceptions: <boolean> syslogFacility: <string> path: <string> logAppend: <boolean> logRotate: <string> destination: <string> timeStampFormat: <string> component: accessControl: verbosity: <int> command: verbosity: <int> # COMMENT additional component verbosity settings omitted for brevity
```

```
systemLog.verbosity
```

Type: integer
Default: 0
The default [log message](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-messages-ref) verbosity level for [components](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-message-components). The verbosity level determines the amount of [Informational and Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages MongoDB outputs. [[2]](https://www.mongodb.com/docs/manual/reference/configuration-options/#footnote-log-message)
The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

To use a different verbosity level for a named component, use the component's verbosity setting. For example, use the [systemLog.component.accessControl.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.accessControl.verbosity) to set the verbosity level specifically for [ACCESS](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-ACCESS) components.

```
systemLog.component.accessControl.verbosity
```

```
ACCESS
```

See the systemLog.component.<name>.verbosity settings for specific component verbosity settings.

```
systemLog.component.<name>.verbosity
```

For various ways to set the log verbosity level, see [Configure Log Verbosity Levels.](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-messages-configure-verbosity)
- log messages

```

```

```

```

```
systemLog.quiet
```

Type: boolean
Default: false
Run [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod in a quiet mode that attempts to limit the amount of output.

```
mongos
```

```
mongod
```

[systemLog.quiet](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.quiet) is not recommended for production systems as it may make tracking problems during particular connections much more difficult.

```
systemLog.quiet
```

```
systemLog.traceAllExceptions
```

Type: boolean
Default: false
Print verbose information for debugging. Use for additional logging for support-related troubleshooting.

```
systemLog.syslogFacility
```

Type: string
Default: user
The facility level used when logging messages to syslog. The value you specify must be supported by your operating system's implementation of syslog. To use this option, you must set [systemLog.destination](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.destination) to syslog.

```
systemLog.destination
```

```
syslog
```

```
systemLog.path
```

Type: string

The path of the log file to which [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) should send all diagnostic logging information, rather than the standard output or the host's [syslog](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-syslog). MongoDB creates the log file at the specified path.

```
mongod
```

```
mongos
```

The Linux package init scripts do not expect [[systemLog.path](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.path)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.path) to change from the defaults. If you use the Linux packages and change systemLog.path, you must use your own init scripts and disable the built-in scripts.

```
systemLog.path
```

```
systemLog.path
```

```
systemLog.logAppend
```

Type: boolean
Default: false
When true, [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod appends new entries to the end of the existing log file when the instance restarts. Without this option, mongod or mongos backs up the existing log and create a new file.

```
true
```

```
mongos
```

```
mongod
```

```
mongod
```

```
mongos
```

```
systemLog.logRotate
```

Type: string
Default: rename
Determines the behavior for the [logRotate](https://www.mongodb.com/docs/manual/reference/command/logRotate/#mongodb-dbcommand-dbcmd.logRotate) command when rotating the server log and/or the audit log. Specify either rename or reopen:

```
logRotate
```

```
rename
```

```
reopen
```

- rename renames the log file.
- reopen closes and reopens the log file following the typical
Linux/Unix log rotate behavior. Use reopen when using the
Linux/Unix logrotate utility to avoid log loss.If you specify reopen, you must also set [systemLog.logAppend](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.logAppend) to true.
rename renames the log file.

```
rename
```

reopen closes and reopens the log file following the typical Linux/Unix log rotate behavior. Use reopen when using the Linux/Unix logrotate utility to avoid log loss.

```
reopen
```

```
reopen
```

If you specify reopen, you must also set [systemLog.logAppend](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.logAppend) to true.

```
reopen
```

```
systemLog.logAppend
```

```
true
```

```
systemLog.destination
```

Type: string
The destination to which MongoDB sends all log output. Specify either file or syslog. If you specify file, you must also specify [systemLog.path.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.path)

```
file
```

```
syslog
```

```
file
```

```
systemLog.path
```

If you do not specify [systemLog.destination](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.destination), MongoDB sends all log output to standard output.

```
systemLog.destination
```

## Warning
The syslog daemon generates timestamps when it logs a message, not when MongoDB issues the message. This can lead to misleading timestamps for log entries, especially when the system is under heavy load. We recommend using the file option for production systems to ensure accurate timestamps.

```
syslog
```

```
file
```

```
systemLog.timeStampFormat
```

Type: string
Default: iso8601-local
The time format for timestamps in log messages. Specify one of the following values:
iso8601-utc

```
iso8601-utc
```

Displays timestamps in Coordinated Universal Time (UTC) in the ISO-8601 format. For example, for New York at the start of the Epoch: 1970-01-01T00:00:00.000Z

```
1970-01-01T00:00:00.000Z
```

iso8601-local

```
iso8601-local
```

Displays timestamps in local time in the ISO-8601 format. For example, for New York at the start of the Epoch: 1969-12-31T19:00:00.000-05:00

```
1969-12-31T19:00:00.000-05:00
```

## Note
[systemLog.timeStampFormat](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.timeStampFormat) no longer supports ctime. An example of ctime formatted date is: Wed Dec 31 18:17:54.811.

```
systemLog.timeStampFormat
```

```
ctime
```

```
ctime
```

```
Wed Dec 31 18:17:54.811
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#systemlog.component-optionssystemLog.component Options

```
systemLog.component
```

```
systemLog: component: accessControl: verbosity: <int> command: verbosity: <int> # COMMENT some component verbosity settings omitted for brevity replication: verbosity: <int> election: verbosity: <int> heartbeats: verbosity: <int> initialSync: verbosity: <int> rollback: verbosity: <int> storage: verbosity: <int> journal: verbosity: <int> recovery: verbosity: <int> write: verbosity: <int>
```

```
systemLog: component: accessControl: verbosity: <int> command: verbosity: <int> # COMMENT some component verbosity settings omitted for brevity replication: verbosity: <int> election: verbosity: <int> heartbeats: verbosity: <int> initialSync: verbosity: <int> rollback: verbosity: <int> storage: verbosity: <int> journal: verbosity: <int> recovery: verbosity: <int> write: verbosity: <int>
```

Starting in version 4.2, MongoDB includes the Debug verbosity level (1-5) in the [log messages](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels). For example, if the verbosity level is 2, MongoDB logs D2. In previous versions, MongoDB log messages only specified D for Debug level.

```

```

```

```

```
systemLog.component.assert.verbosity
```

Type: integer
Default: 0
The log message verbosity level for assertions encountered by user operations in MongoDB. Typically an assertion is triggered when an operation returns an error. See [ASSERT](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-ASSERT) components.

```
ASSERT
```

```
systemLog.component.accessControl.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to access control. See [ACCESS](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-ACCESS) components.

```
ACCESS
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.command.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to commands. See [COMMAND](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-COMMAND) components.

```
COMMAND
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.control.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to control operations. See [CONTROL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-CONTROL) components.

```
CONTROL
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.ftdc.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to diagnostic data collection operations. See [FTDC](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-FTDC) components.

```
FTDC
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include

[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.geo.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to geospatial parsing operations. See [GEO](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-GEO) components.

```
GEO
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.index.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to indexing operations. See [INDEX](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-INDEX) components.

```
INDEX
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.network.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to networking operations. See [NETWORK](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-NETWORK) components.

```
NETWORK
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.query.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to query operations. See [QUERY](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-QUERY) components.

```
QUERY
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.query.rejected.verbosity
```

Type: integer
Default: 0
New in version 8.0.
The log message verbosity level for components related to [rejected query operations](https://www.mongodb.com/docs/manual/tutorial/operation-rejection-filters/#std-label-operation-rejection-filters). For details, see the [REJECTED](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REJECTED) component.

```
REJECTED
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.queryStats.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to invocations of $queryStats. See [QUERYSTATS](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-QUERYSTATS) components.

```
$queryStats
```

```
QUERYSTATS
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the default log verbosity level, and only includes
[informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages. No $queryStats
calls are logged at this level.
- 1 to 2 increases the verbosity level to include $queryStats
calls where algorithm is "hmac-sha-256". Any HMAC keys are
redacted.
- 3 to 5 increases the verbosity level to include
$queryStats calls where algorithm is
"hmac-sha-256", and the corresponding results. Each result is its own
entry and there is a final entry with the string "we finished".
0 is the default log verbosity level, and only includes [informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages. No $queryStats calls are logged at this level.

```

```

```
$queryStats
```

1 to 2 increases the verbosity level to include $queryStats calls where algorithm is "hmac-sha-256". Any HMAC keys are redacted.

```

```

```

```

```
$queryStats
```

```
algorithm
```

```
"hmac-sha-256"
```

3 to 5 increases the verbosity level to include $queryStats calls where algorithm is "hmac-sha-256", and the corresponding results. Each result is its own entry and there is a final entry with the string "we finished".

```

```

```

```

```
$queryStats
```

```
algorithm
```

```
"hmac-sha-256"
```

```
"we finished"
```

```
systemLog.component.replication.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to replication. See [REPL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REPL) components.

```
REPL
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.replication.election.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to election. See [ELECTION](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-ELECTION) components.

```
ELECTION
```

If [systemLog.component.replication.election.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.election.verbosity) is unset, [systemLog.component.replication.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.verbosity) level also applies to election components.

```
systemLog.component.replication.election.verbosity
```

```
systemLog.component.replication.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.replication.heartbeats.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to heartbeats. See [REPL_HB](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-REPL_HB) components.

```
REPL_HB
```

If [systemLog.component.replication.heartbeats.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.heartbeats.verbosity) is unset, [systemLog.component.replication.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.verbosity) level also applies to heartbeats components.

```
systemLog.component.replication.heartbeats.verbosity
```

```
systemLog.component.replication.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.replication.initialSync.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to initialSync. See [INITSYNC](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-INITSYNC) components.

```
INITSYNC
```

If [systemLog.component.replication.initialSync.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.initialSync.verbosity) is unset, [systemLog.component.replication.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.verbosity) level also applies to initialSync components.

```
systemLog.component.replication.initialSync.verbosity
```

```
systemLog.component.replication.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.replication.rollback.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to rollback. See [ROLLBACK](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-ROLLBACK) components.

```
ROLLBACK
```

If [systemLog.component.replication.rollback.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.rollback.verbosity) is unset, [systemLog.component.replication.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.replication.verbosity) level also applies to rollback components.

```
systemLog.component.replication.rollback.verbosity
```

```
systemLog.component.replication.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.sharding.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to sharding. See [SHARDING](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-SHARDING) components.

```
SHARDING
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to storage. See [STORAGE](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-STORAGE) components.

```
STORAGE
```

If [systemLog.component.storage.journal.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.storage.journal.verbosity) is unset, [systemLog.component.storage.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.storage.verbosity) level also applies to journaling components.

```
systemLog.component.storage.journal.verbosity
```

```
systemLog.component.storage.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.journal.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to journaling. See [JOURNAL](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-JOURNAL) components.

```
JOURNAL
```

If [systemLog.component.storage.journal.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.storage.journal.verbosity) is unset, the journaling components have the same verbosity level as the parent storage components: i.e. either the [systemLog.component.storage.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.storage.verbosity) level if set or the default verbosity level.

```
systemLog.component.storage.journal.verbosity
```

```
systemLog.component.storage.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.recovery.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to recovery. See [RECOVERY](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-RECOVERY) components.

```
RECOVERY
```

If [systemLog.component.storage.recovery.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.storage.recovery.verbosity) is unset, [systemLog.component.storage.verbosity](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.component.storage.verbosity) level also applies to recovery components.

```
systemLog.component.storage.recovery.verbosity
```

```
systemLog.component.storage.verbosity
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity level for components related to the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WT](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WT) components.

```

```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtBackup.verbosity
```

Type: integer
Default: -1
New in version 5.3.

The log message verbosity level for components related to backup operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTBACKUP](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTBACKUP) components.

```
WTBACKUP
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtCheckpoint.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to checkpoint operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTCHKPT](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTCHKPT) components.

```
WTCHKPT
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtCompact.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to compaction operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTCMPCT](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTCMPCT) components.

```
WTCMPCT
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtEviction.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to eviction operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTEVICT](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTEVICT) components.

```
WTEVICT
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtHS.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to history store operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTHS](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTHS) components.

```
WTHS
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtRecovery.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to recovery operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTRECOV](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTRECOV) components.

```
WTRECOV
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtRTS.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to rollback to stable (RTS) operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTRTS](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTRTS) components.

```
WTRTS
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtSalvage.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to salvage operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTSLVG](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTSLVG) components.

```
WTSLVG
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtTimestamp.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to timestamps used by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTTS](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTTS) components.

```
WTTS
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtTransaction.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to transaction operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTTXN](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTTXN) components.

```
WTTXN
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtVerify.verbosity
```

Type: integer
Default: -1
New in version 5.3.
The log message verbosity for components related to verification operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTVRFY](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTVRFY) components.

```
WTVRFY
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.storage.wt.wtWriteLog.verbosity
```

Type: integer
Default: -1
New in version 5.3.

The log message verbosity for components related to log write operations performed by the [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine. See [WTWRTLOG](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WTWRTLOG) components.

```
WTWRTLOG
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.transaction.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to transaction. See [TXN](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-TXN) components.

```
TXN
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
systemLog.component.write.verbosity
```

Type: integer
Default: 0
The log message verbosity level for components related to write operations. See [WRITE](https://www.mongodb.com/docs/manual/reference/log-messages/#mongodb-data-WRITE) components.

```
WRITE
```

The verbosity level can range from 0 to 5:

```

```

```

```

- 0 is the MongoDB's default log verbosity level, to include
[Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
- 1 to 5 increases the verbosity level to include
[Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.
0 is the MongoDB's default log verbosity level, to include [Informational](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

1 to 5 increases the verbosity level to include [Debug](https://www.mongodb.com/docs/manual/reference/log-messages/#std-label-log-severity-levels) messages.

```

```

```

```

```
processManagement
```

```
processManagement: fork: <boolean> pidFilePath: <string> timeZoneInfo: <string>
```

```
processManagement: fork: <boolean> pidFilePath: <string> timeZoneInfo: <string>
```

```
processManagement.fork
```

Type: boolean
Default: false
Enable a [daemon](https://www.[[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/glossary/#std-term-daemon) mode that runs the [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod process in the background. By default mongos or mongod does not run as a daemon. To use mongos or mongod as a daemon, set [processManagement.fork](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.fork) or use a controlling process that handles the daemonization process (for example, systemd).

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

```
processManagement.fork
```

```
systemd
```

The [processManagement.fork](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.fork) option is not supported on Windows.

```
processManagement.fork
```

The Linux package init scripts do not expect [[processManagement.fork](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.fork)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.fork) to change from the defaults. If you use the Linux packages and change processManagement.fork, you must use your own init scripts and disable the built-in scripts.

```
processManagement.fork
```

```
processManagement.fork
```

Alternatively, you can set the MONGODB_CONFIG_OVERRIDE_NOFORK environment variable on your system to true to run the [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod process in the background. If you set the environment variable, it overrides the setting for processManagement.fork.

```
MONGODB_CONFIG_OVERRIDE_NOFORK
```

```
true
```

```
mongos
```

```
mongod
```

```
processManagement.fork
```

```
processManagement.pidFilePath
```

Type: string
Specifies a file location to store the process ID (PID) of the [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod process. The user running the mongod or mongos process must be able to write to this path. If the [processManagement.pidFilePath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.pidFilePath) option is not specified, the process does not create a PID file. This option is generally only useful in combination with the [processManagement.fork](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.fork) setting.

```
mongos
```

```
mongod
```

```
mongod
```

```
mongos
```

```
processManagement.pidFilePath
```

```
processManagement.fork
```

### Linux
On Linux, PID file management is generally the responsibility of your distro's init system: usually a service file in the /etc/init.d directory, or a systemd unit file registered with systemctl. Only use the [processManagement.pidFilePath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.pidFilePath) option if you are not using one of these init systems. For more information, please see the respective [Installation Guide](https://www.mongodb.com/docs/manual/installation/#std-label-tutorial-installation) for your operating system.

```
/etc/init.d
```

```
systemctl
```

```
processManagement.pidFilePath
```

### macOS
On macOS, PID file management is generally handled by brew. Only use the [processManagement.pidFilePath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.pidFilePath) option if you are not using brew on your macOS system. For more information, please see the respective Installation Guide for your operating system.

```
brew
```

```
processManagement.pidFilePath
```

```
brew
```

```
processManagement.timeZoneInfo
```

Type: string
The full path from which to load the time zone database. If this option is not provided, then MongoDB uses its built-in time zone database.
The configuration file included with Linux and macOS packages sets the time zone database path to /usr/share/zoneinfo by default.

```
/usr/share/zoneinfo
```

The built-in time zone database is a copy of the [Olson/IANA time zone database](https://www.iana.org/time-zones). It is updated along with MongoDB releases, but the time zone database release cycle differs from the MongoDB release cycle. The most recent release of the time zone database is available on our [download site](https://downloads.mongodb.org/olson_tz_db/timezonedb-latest.zip).

MongoDB uses the third party [timelib](https://github.com/derickr/timelib) library to provide accurate conversions between timezones. Due to a recent update, timelib could create inaccurate time zone conversions in older versions of MongoDB.

```
timelib
```

To explicitly link to the [time zone database](https://downloads.mongodb.org/olson_tz_db/timezonedb-latest.zip) in versions of MongoDB prior to 5.0, download the time zone database. and use the [timeZoneInfo](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--timeZoneInfo) parameter.

```
timeZoneInfo
```

```
net
```

Changed in version 5.0: MongoDB removes the net.serviceExecutor configuration option and the corresponding --serviceExecutor command-line option.

```
net.serviceExecutor
```

```
--serviceExecutor
```

```
net: port: <int> bindIp: <string> bindIpAll: <boolean> maxIncomingConnections: <int> wireObjectCheck: <boolean> ipv6: <boolean> unixDomainSocket: enabled: <boolean> pathPrefix: <string> filePermissions: <int> tls: certificateSelector: <string> clusterCertificateSelector: <string> mode: <string> certificateKeyFile: <string> certificateKeyFilePassword: <string> clusterFile: <string> clusterPassword: <string> CAFile: <string> clusterCAFile: <string> clusterAuthX509: attributes: <string> extensionValue: <string> CRLFile: <string> allowConnectionsWithoutCertificates: <boolean> allowInvalidCertificates: <boolean> allowInvalidHostnames: <boolean> disabledProtocols: <string> FIPSMode: <boolean> logVersions: <string> compression: compressors: <string>
```

```
net: port: <int> bindIp: <string> bindIpAll: <boolean> maxIncomingConnections: <int> wireObjectCheck: <boolean> ipv6: <boolean> unixDomainSocket: enabled: <boolean> pathPrefix: <string> filePermissions: <int> tls: certificateSelector: <string> clusterCertificateSelector: <string> mode: <string> certificateKeyFile: <string> certificateKeyFilePassword: <string> clusterFile: <string> clusterPassword: <string> CAFile: <string> clusterCAFile: <string> clusterAuthX509: attributes: <string> extensionValue: <string> CRLFile: <string> allowConnectionsWithoutCertificates: <boolean> allowInvalidCertificates: <boolean> allowInvalidHostnames: <boolean> disabledProtocols: <string> FIPSMode: <boolean> logVersions: <string> compression: compressors: <string>
```

```
net.port
```

Type: integer
Default:
- 27017 for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) (if not a shard member or a config server
member) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance
- 27018 if [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) is a [shard member](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-sharding.clusterRole)
- 27019 if [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) is a [config server member](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-sharding.clusterRole)
27017 for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) (if not a shard member or a config server member) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance

```
mongod
```

```
mongos
```

27018 if [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) is a [shard member](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-sharding.clusterRole)

```
mongod
```

```
shard member
```

27019 if [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) is a [config server member](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-sharding.clusterRole)

```
mongod
```

```
config server member
```

The TCP port on which the MongoDB instance listens for client connections.
The net.port option accepts a range of values between 0 and 65535. Setting the port to 0 configures [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod to use an arbitrary port assigned by the operating system.

```
net.port
```

```

```

```
65535
```

```

```

```
mongos
```

```
mongod
```

```
net.bindIp
```

Type: string
Default: localhost

The hostnames and/or IP addresses and/or full Unix domain socket paths on which [[mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod should listen for client connections. You may attach mongos or mongod to any interface. To bind to multiple addresses, enter a list of comma-separated values.

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

## Example
localhost,/tmp/mongod.sock

```
localhost,/tmp/mongod.sock
```

You can specify both IPv4 and IPv6 addresses, or hostnames that resolve to an IPv4 or IPv6 address.

## Example
localhost, 2001:0DB8:e132:ba26:0d5c:2774:e7f9:d513

```
localhost, 2001:0DB8:e132:ba26:0d5c:2774:e7f9:d513
```

## Note
If specifying an IPv6 address or a hostname that resolves to an IPv6 address to [[net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp), you must start [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod with [net.ipv6 : true](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.ipv6) to enable IPv6 support. Specifying an IPv6 address to net.bindIp does not enable IPv6 support.

```
net.bindIp
```

```
mongos
```

```
mongod
```

```
net.ipv6 : true
```

```
net.bindIp
```

If specifying a [link-local IPv6 address](https://en.wikipedia.org/wiki/Link-local_address#IPv6) (fe80::/10), you must append the [zone index](https://en.wikipedia.org/wiki/IPv6_address#Scoped_literal_IPv6_addresses_(with_zone_index)) to that address (i.e. fe80::<address>%<adapter-name>).

```
fe80::/10
```

```
fe80::<address>%<adapter-name>
```

## Example
localhost,fe80::a00:27ff:fee0:1fcf%enp0s3

```
localhost,fe80::a00:27ff:fee0:1fcf%enp0s3
```

## Important
To avoid configuration updates due to IP address changes, use DNS hostnames instead of IP addresses. It is particularly important to use a DNS hostname instead of an IP address when configuring replica set members or sharded cluster members.
Use hostnames instead of IP addresses to configure clusters across a split network horizon. Starting in MongoDB 5.0, nodes that are only configured with an IP address fail startup validation and do not start.

## Warning
Before you bind your instance to a publicly-accessible IP address, you must secure your cluster from unauthorized access. For a complete list of security recommendations, see [Security Checklist for Self-Managed Deployments](https://www.mongodb.com/docs/manual/administration/security-checklist/#std-label-security-checklist). At minimum, consider [enabling authentication](https://www.mongodb.com/docs/manual/administration/security-checklist/#std-label-checklist-auth) and [hardening network infrastructure.](https://www.mongodb.com/docs/manual/core/security-hardening/#std-label-network-config-hardening)
For more information about IP Binding, refer to the [IP Binding in Self-Managed Deployments](https://www.mongodb.com/docs/manual/core/security-mongodb-configuration/) documentation.
To bind to all IPv4 addresses, enter 0.0.0.0.

```
0.0.0.0
```

To bind to all IPv4 and IPv6 addresses, enter ::,0.0.0.0 or an asterisk "*" (enclose the asterisk in quotes to distinguish from [YAML alias nodes](https://yaml.org/spec/1.2/spec.html#alias/)). Alternatively, use the [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) setting.

```
::,0.0.0.0
```

```
"*"
```

```
net.bindIpAll
```

- [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) and [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) are mutually
exclusive. That is, you can specify one or the other, but not
both.
- The command-line option --bind_ip overrides the configuration
file setting [net.bindIp.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp)
[net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) and [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) are mutually exclusive. That is, you can specify one or the other, but not both.

```
net.bindIp
```

```
net.bindIpAll
```

The command-line option --bind_ip overrides the configuration file setting [net.bindIp.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp)

```
--bind_ip
```

```
net.bindIp
```

To configure cluster nodes for [split horizon DNS](https://en.wikipedia.org/wiki/Split-horizon_DNS), use host names instead of IP addresses.
Starting in MongoDB v5.0, [replSetInitiate](https://www.mongodb.com/docs/manual/reference/command/replSetInitiate/#mongodb-dbcommand-dbcmd.replSetInitiate) and [replSetReconfig](https://www.mongodb.com/docs/manual/reference/command/replSetReconfig/#mongodb-dbcommand-dbcmd.replSetReconfig) reject configurations that use IP addresses instead of hostnames.

```
replSetInitiate
```

```
replSetReconfig
```

Use [disableSplitHorizonIPCheck](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.disableSplitHorizonIPCheck) to modify nodes that cannot be updated to use host names. The parameter only applies to the configuration commands.

```
disableSplitHorizonIPCheck
```

[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) do not rely on [disableSplitHorizonIPCheck](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.disableSplitHorizonIPCheck) for validation at startup. Legacy mongod and mongos instances that use IP addresses instead of host names can start after an upgrade.

```
mongod
```

```
mongos
```

```
disableSplitHorizonIPCheck
```

```
mongod
```

```
mongos
```

Instances that are configured with IP addresses log a warning to use host names instead of IP addresses.

```
net.bindIpAll
```

Type: boolean
Default: false
If true, the [[mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod instance binds to all IPv4 addresses (i.e. 0.0.0.0). If mongos or mongod starts with [net.ipv6 : true](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.ipv6), [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) also binds to all IPv6 addresses (i.e. ::).

```
mongos
```

```
mongod
```

```
0.0.0.0
```

```
mongos
```

```
mongod
```

```
net.ipv6 : true
```

```
net.bindIpAll
```

```

```

[mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod only supports IPv6 if started with [net.ipv6 : true](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.ipv6). Specifying [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) alone does not enable IPv6 support.

```
mongos
```

```
mongod
```

```
net.ipv6 : true
```

```
net.bindIpAll
```

## Warning
Before you bind your instance to a publicly-accessible IP address, you must secure your cluster from unauthorized access. For a complete list of security recommendations, see [Security Checklist for Self-Managed Deployments](https://www.mongodb.com/docs/manual/administration/security-checklist/#std-label-security-checklist). At minimum, consider [enabling authentication](https://www.mongodb.com/docs/manual/administration/security-checklist/#std-label-checklist-auth) and [hardening network infrastructure.](https://www.mongodb.com/docs/manual/core/security-hardening/#std-label-network-config-hardening)
For more information about IP Binding, refer to the [IP Binding in Self-Managed Deployments](https://www.mongodb.com/docs/manual/core/security-mongodb-configuration/) documentation.
Alternatively, set [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) to ::,0.0.0.0 or to an asterisk "*" (enclose the asterisk in quotes to distinguish from [YAML alias nodes](https://yaml.org/spec/1.2/spec.html#alias/)) to bind to all IP addresses.

```
net.bindIp
```

```
::,0.0.0.0
```

```
"*"
```

## Note
[net.bindIp](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) and [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) are mutually exclusive. Specifying both options causes [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod to throw an error and terminate.

```
net.bindIp
```

```
net.bindIpAll
```

```
mongos
```

```
mongod
```

```
net.maxIncomingConnections
```

Type: integer
Changed in version 8.1: (and 8.0.16, 7.0.27)

On Linux, net.maxIncomingConnections must be less than or equal to the value of (RLIMIT_NOFILE / 2) * 0.8. If you try to set a larger value, MongoDB automatically uses the default.

```
net.maxIncomingConnections
```

The maximum number of simultaneous connections that [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod accepts. This setting has no effect if it is higher than your operating system's configured maximum connection tracking threshold.

```
mongos
```

```
mongod
```

Do not assign too low of a value to this option, or you may encounter errors during normal application operation.
This is particularly useful for a [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) if you have a client that creates multiple connections and allows them to timeout rather than closing them.

```
mongos
```

In this case, set [maxIncomingConnections](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.maxIncomingConnections) to a value slightly higher than the maximum number of connections that the client creates, or the maximum size of the connection pool.

```
maxIncomingConnections
```

This setting prevents the mongos from causing connection spikes on the individual [shards](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-shard). Spikes like these may disrupt the operation and memory allocation of the [sharded cluster.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-sharded-cluster)

```
mongos
```

```
net.wireObjectCheck
```

Type: boolean
Default: true
When true, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance validates all requests from clients upon receipt to prevent clients from inserting malformed or invalid BSON into a MongoDB database.

```
true
```

```
mongod
```

```
mongos
```

For objects with a high degree of sub-document nesting, [net.wireObjectCheck](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.wireObjectCheck) can have a small impact on performance.

```
net.wireObjectCheck
```

```
net.ipv6
```

Type: boolean
Default: false
Set [net.ipv6](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.ipv6) to true to enable IPv6 support. [mongos/](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)mongod disables IPv6 support by default.

```
net.ipv6
```

```
true
```

```
mongos
```

```
mongod
```

Setting [net.ipv6](https://www.[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.ipv6) does not direct the [[mongos/](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)mongod to listen on any local IPv6 addresses or interfaces. To configure the mongos/mongod to listen on an IPv6 interface, you must either:

```
net.ipv6
```

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

- Configure [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) with one or more IPv6 addresses or
hostnames that resolve to IPv6 addresses, or
- Set [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) to true.
Configure [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) with one or more IPv6 addresses or hostnames that resolve to IPv6 addresses, or

```
net.bindIp
```

Set [net.bindIpAll](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIpAll) to true.

```
net.bindIpAll
```

```
true
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#net.unixdomainsocket-optionsnet.unixDomainSocket Options

```
net.unixDomainSocket
```

```
net: unixDomainSocket: enabled: <boolean> pathPrefix: <string> filePermissions: <int>
```

```
net: unixDomainSocket: enabled: <boolean> pathPrefix: <string> filePermissions: <int>
```

```
net.unixDomainSocket.enabled
```

Type: boolean
Default: true
Enable or disable listening on the UNIX domain socket. [net.unixDomainSocket.enabled](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.enabled) applies only to Unix-based systems.

```
net.unixDomainSocket.enabled
```

When [net.unixDomainSocket.enabled](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.enabled) is true, [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod listens on the UNIX socket.

```
net.unixDomainSocket.enabled
```

```
true
```

```
mongos
```

```
mongod
```

The [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod process always listens on the UNIX socket unless one of the following is true:

```
mongos
```

```
mongod
```

- [net.unixDomainSocket.enabled](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.enabled) is false
- --nounixsocket is set. The command
line option takes precedence over the configuration file setting.
- [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) is not set
- [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) does not specify localhost or its associated IP address
[net.unixDomainSocket.enabled](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.enabled) is false

```
net.unixDomainSocket.enabled
```

```
false
```

--nounixsocket is set. The command line option takes precedence over the configuration file setting.

```
--nounixsocket
```

[net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) is not set

```
net.bindIp
```

[net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) does not specify localhost or its associated IP address

```
net.bindIp
```

```
localhost
```

[mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod installed from official [Install MongoDB Community Edition on Debian](https://www.mongodb.com/docs/manual/administration/install-community/#std-label-install-mdb-community-debian) and [Install MongoDB Community Edition on Red Hat or CentOS](https://www.mongodb.com/docs/manual/administration/install-community/#std-label-install-mdb-community-redhat-centos) packages have the bind_ip configuration set to 127.0.0.1 by default.

```
mongos
```

```
mongod
```

```
bind_ip
```

```
127.0.0.1
```

```
net.unixDomainSocket.pathPrefix
```

Type: string
Default: /tmp
The path for the UNIX socket. [net.unixDomainSocket.pathPrefix](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.pathPrefix) applies only to Unix-based systems.

```
net.unixDomainSocket.pathPrefix
```

If this option has no value, the [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod process creates a socket with /tmp as a prefix. MongoDB creates and listens on a UNIX socket unless one of the following is true:

```
mongos
```

```
mongod
```

```
/tmp
```

- [net.unixDomainSocket.enabled](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.enabled) is false
- --nounixsocket is set
- [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) is not set

- [net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) does not specify localhost or its associated IP address
[net.unixDomainSocket.enabled](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.enabled) is false

```
net.unixDomainSocket.enabled
```

```
false
```

--nounixsocket is set

```
--nounixsocket
```

[net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) is not set

```
net.bindIp
```

[net.bindIp](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.bindIp) does not specify localhost or its associated IP address

```
net.bindIp
```

```
localhost
```

```
net.unixDomainSocket.filePermissions
```

Type: int
Default: 0700

```
0700
```

Sets the permission for the UNIX domain socket file.
[net.unixDomainSocket.filePermissions](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.unixDomainSocket.filePermissions) applies only to Unix-based systems.

```
net.unixDomainSocket.filePermissions
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#net.tls-optionsnet.tls Options

```
net.tls
```

The tls options provide identical functionality as the previous ssl options.

```
tls
```

```
ssl
```

```
net: tls: mode: <string> certificateKeyFile: <string> certificateKeyFilePassword: <string> certificateSelector: <string> clusterCertificateSelector: <string> clusterFile: <string> clusterPassword: <string> clusterAuthX509: attributes: <string> extensionValue: <string> CAFile: <string> clusterCAFile: <string> CRLFile: <string> allowConnectionsWithoutCertificates: <boolean> allowInvalidCertificates: <boolean> allowInvalidHostnames: <boolean> disabledProtocols: <string> FIPSMode: <boolean> logVersions: <string>
```

```
net: tls: mode: <string> certificateKeyFile: <string> certificateKeyFilePassword: <string> certificateSelector: <string> clusterCertificateSelector: <string> clusterFile: <string> clusterPassword: <string> clusterAuthX509: attributes: <string> extensionValue: <string> CAFile: <string> clusterCAFile: <string> CRLFile: <string> allowConnectionsWithoutCertificates: <boolean> allowInvalidCertificates: <boolean> allowInvalidHostnames: <boolean> disabledProtocols: <string> FIPSMode: <boolean> logVersions: <string>
```

```
net.tls.mode
```

Type: string
Enables TLS used for all network connections. The argument to the [net.tls.mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.mode) setting can be one of the following:

```
net.tls.mode
```

disabled

```
disabled
```

The server does not use TLS.
allowTLS

```
allowTLS
```

Connections between servers do not use TLS. For incoming connections, the server accepts both TLS and non-TLS.
preferTLS

```
preferTLS
```

Connections between servers use TLS. For incoming connections, the server accepts both TLS and non-TLS.
requireTLS

```
requireTLS
```

The server uses and accepts only TLS encrypted connections.
If --tlsCAFile or tls.CAFile is not specified and you are not using X.509 authentication, you must set the [tlsUseSystemCA](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.tlsUseSystemCA) parameter to true. This makes MongoDB use the system-wide CA certificate store when connecting to a TLS-enabled server.

```
--tlsCAFile
```

```
tls.CAFile
```

```
tlsUseSystemCA
```

```
true
```

If using X.509 authentication, --tlsCAFile or tls.CAFile must be specified unless using [--tlsCertificateSelector.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--tlsCertificateSelector)

```
--tlsCAFile
```

```
tls.CAFile
```

```
--tlsCertificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.certificateKeyFile
```

Type: string
The .pem file that contains both the TLS certificate and key.

```
.pem
```

On macOS or Windows, you can use the [[net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) setting to specify a certificate from the operating system's secure certificate store instead of a PEM key file. [certificateKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) and net.tls.certificateSelector are mutually exclusive. You can only specify one.

```
net.tls.certificateSelector
```

```
certificateKeyFile
```

```
net.tls.certificateSelector
```

- On Linux/BSD, you must specify
[net.tls.certificateKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) when TLS is enabled.
- On Windows or macOS, you must specify either
[net.tls.certificateKeyFile](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) or
[net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) when TLS is enabled.ImportantFor Windows only, MongoDB does not support
encrypted PEM files. The mongod fails to start if

it encounters an encrypted PEM file. To securely store and
access a certificate for use with TLS on Windows,
use [net.tls.certificateSelector.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector)
On Linux/BSD, you must specify [net.tls.certificateKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) when TLS is enabled.

```
net.tls.certificateKeyFile
```

On Windows or macOS, you must specify either [net.tls.certificateKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) or [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) when TLS is enabled.

```
net.tls.certificateKeyFile
```

```
net.tls.certificateSelector
```

For Windows only, MongoDB does not support encrypted PEM files. The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) fails to start if it encounters an encrypted PEM file. To securely store and access a certificate for use with TLS on Windows, use [net.tls.certificateSelector.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector)

```
mongod
```

```
net.tls.certificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.certificateKeyFilePassword
```

Type: string
The password to de-crypt the certificate-key file (i.e. [certificateKeyFile](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile)). Use the [net.tls.certificateKeyFilePassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFilePassword) option only if the certificate-key file is encrypted. In all cases, the [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod redacts the password from all logging and reporting output.

```
certificateKeyFile
```

```
net.tls.certificateKeyFilePassword
```

```
mongos
```

```
mongod
```

On Linux/BSD, if the private key in the PEM file is encrypted and you do not specify the [net.tls.certificateKeyFilePassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFilePassword) option, MongoDB prompts for a passphrase.

```
net.tls.certificateKeyFilePassword
```

For more information, see [TLS/SSL Certificate Passphrase.](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/#std-label-ssl-certificate-password)
On macOS, if the private key in the PEM file is encrypted, you must explicitly specify the [net.tls.certificateKeyFilePassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFilePassword) option. Alternatively, you can use a certificate from the secure system store (see [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector)) instead of a PEM key file or use an unencrypted PEM file.

```
net.tls.certificateKeyFilePassword
```

```
net.tls.certificateSelector
```

On Windows, MongoDB does not support encrypted certificates. The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) fails if it encounters an encrypted PEM file. Use [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) instead.

```
mongod
```

```
net.tls.certificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.certificateSelector
```

Type: string
Specifies a certificate property in order to select a matching certificate from the operating system's certificate store to use for TLS/SSL. Available on Windows and macOS as an alternative to [net.tls.certificateKeyFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile)

```
net.tls.certificateKeyFile
```

[net.tls.certificateKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) and [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) options are mutually exclusive. You can only specify one.

```
net.tls.certificateKeyFile
```

```
net.tls.certificateSelector
```

## Important
[net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) accepts an argument of the format <property>=<value> where the property can be one of the following:

```
net.tls.certificateSelector
```

```
<property>=<value>
```

subject

```
subject
```

ASCII string
Subject name or common name on certificate
thumbprint

```
thumbprint
```

hex string
A sequence of bytes, expressed as hexadecimal, used to identify a public key by its SHA-1 digest.
The thumbprint is sometimes referred to as a fingerprint.

```
thumbprint
```

```
fingerprint
```

When using the system SSL certificate store, OCSP (Online Certificate Status Protocol) is used to validate the revocation status of certificates.
The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) searches the operating system's secure certificate store for the CA certificates required to validate the full certificate chain of the specified TLS certificate. Specifically, the secure certificate store must contain the root CA and any intermediate CA certificates required to build the full certificate chain to the TLS certificate.

```
mongod
```

## Warning
If you use net.tls.certificateSelector and/or [net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector), we do not recommend using [net.tls.CAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CAFile) or [net.tls.clusterFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterFile) to specify the root and intermediate CA certificate

```
net.tls.certificateSelector
```

```
net.tls.clusterCertificateSelector
```

```
net.tls.CAFile
```

```
net.tls.clusterFile
```

For example, if the TLS certificate was signed with a single root CA certificate, the secure certificate store must contain that root CA certificate. If the TLS certificate was signed with an intermediate CA certificate, the secure certificate store must contain the intermedia CA certificate and the root CA certificate.

You cannot use the [rotateCertificates](https://www.mongodb.com/docs/manual/reference/command/rotateCertificates/#mongodb-dbcommand-dbcmd.rotateCertificates) command or the [db.rotateCertificates()](https://www.mongodb.com/docs/manual/reference/method/db.rotateCertificates/#mongodb-method-db.rotateCertificates) shell method when using [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) or [--tlsCertificateSelector](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--tlsCertificateSelector) set to thumbprint

```
rotateCertificates
```

```
db.rotateCertificates()
```

```
net.tls.certificateSelector
```

```
--tlsCertificateSelector
```

```
thumbprint
```

```
net.tls.clusterCertificateSelector
```

Type: string
Specifies a certificate property to select a matching certificate from the operating system's secure certificate store to use for [internal X.509 membership authentication.](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-internal-auth-x509)
Available on Windows and macOS as an alternative to [net.tls.clusterFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterFile)

```
net.tls.clusterFile
```

[net.tls.clusterFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterFile) and [net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector) options are mutually exclusive. You can only specify one.

```
net.tls.clusterFile
```

```
net.tls.clusterCertificateSelector
```

[net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector) accepts an argument of the format <property>=<value> where the property can be one of the following:

```
net.tls.clusterCertificateSelector
```

```
<property>=<value>
```

subject

```
subject
```

ASCII string
Subject name or common name on certificate
thumbprint

```
thumbprint
```

hex string
A sequence of bytes, expressed as hexadecimal, used to identify a public key by its SHA-1 digest.
The thumbprint is sometimes referred to as a fingerprint.

```
thumbprint
```

```
fingerprint
```

The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) searches the operating system's secure certificate store for the CA certificates required to validate the full certificate chain of the specified cluster certificate. Specifically, the secure certificate store must contain the root CA and any intermediate CA certificates required to build the full certificate chain to the cluster certificate.

```
mongod
```

If you use [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) and/or net.tls.clusterCertificateSelector, we do not recommend using [net.tls.CAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CAFile) or [net.tls.clusterCAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCAFile) to specify the root and intermediate CA certificate.

```
net.tls.certificateSelector
```

```
net.tls.clusterCertificateSelector
```

```
net.tls.CAFile
```

```
net.tls.clusterCAFile
```

For example, if the cluster certificate was signed with a single root CA certificate, the secure certificate store must contain that root CA certificate. If the cluster certificate was signed with an intermediate CA certificate, the secure certificate store must contain the intermediate CA certificate and the root CA certificate.
[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) / [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) logs a warning on connection if the presented X.509 certificate expires within 30 days of the mongod/mongos host system time.

```
mongod
```

```
mongos
```

```

```

```
mongod/mongos
```

```
net.tls.clusterFile
```

Type: string
The .pem file that contains the X.509 certificate-key file for [membership authentication](https://www.mongodb.com/docs/manual/tutorial/configure-x509-member-authentication/#std-label-x509-internal-authentication) for the cluster or replica set.

```
.pem
```

On macOS or Windows, you can use the [[net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector) option to specify a certificate from the operating system's secure certificate store instead of a PEM key file. [net.tls.clusterFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterFile) and net.tls.clusterCertificateSelector options are mutually exclusive. You can only specify one.

```
net.tls.clusterCertificateSelector
```

```
net.tls.clusterFile
```

```
net.tls.clusterCertificateSelector
```

If [net.tls.clusterFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterFile) does not specify the .pem file for internal cluster authentication or the alternative [net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector), the cluster uses the .pem file specified in the [certificateKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateKeyFile) setting or the certificate returned by the [net.tls.certificateSelector.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector)

```
net.tls.clusterFile
```

```
.pem
```

```
net.tls.clusterCertificateSelector
```

```
.pem
```

```
certificateKeyFile
```

```
net.tls.certificateSelector
```

If using X.509 authentication, --tlsCAFile or tls.CAFile must be specified unless using [--tlsCertificateSelector.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--tlsCertificateSelector)

```
--tlsCAFile
```

```
tls.CAFile
```

```
--tlsCertificateSelector
```

[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) / [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) logs a warning on connection if the presented X.509 certificate expires within 30 days of the mongod/mongos host system time.

```
mongod
```

```
mongos
```

```

```

```
mongod/mongos
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

For Windows only, MongoDB does not support encrypted PEM files. The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) fails to start if it encounters an encrypted PEM file. To securely store and access a certificate for use with membership authentication on Windows, use [net.tls.clusterCertificateSelector.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector)

```
mongod
```

```
net.tls.clusterCertificateSelector
```

```
net.tls.clusterPassword
```

Type: string
The password to de-crypt the X.509 certificate-key file specified with --sslClusterFile. Use the [net.tls.clusterPassword](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterPassword) option only if the certificate-key file is encrypted. In all cases, [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod redacts the password from all logging and reporting output.

```
--sslClusterFile
```

```
net.tls.clusterPassword
```

```
mongos
```

```
mongod
```

On Linux/BSD, if the private key in the X.509 file is encrypted and you do not specify the [net.tls.clusterPassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterPassword) option, MongoDB prompts for a passphrase.

```
net.tls.clusterPassword
```

For more information, see [TLS/SSL Certificate Passphrase.](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/#std-label-ssl-certificate-password)
On macOS, if the private key in the X.509 file is encrypted, you must explicitly specify the [net.tls.clusterPassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterPassword) option. Alternatively, you can either use a certificate from the secure system store (see [net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector)) instead of a cluster PEM file or use an unencrypted PEM file.

```
net.tls.clusterPassword
```

```
net.tls.clusterCertificateSelector
```

On Windows, MongoDB does not support encrypted certificates. The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) fails if it encounters an encrypted PEM file. Use [net.tls.clusterCertificateSelector.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector)

```
mongod
```

```
net.tls.clusterCertificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.clusterAuthX509
```

New in version 7.0.

```
net: tls: clusterAuthX509: attributes: <string> extensionValue: <string>
```

```
net: tls: clusterAuthX509: attributes: <string> extensionValue: <string>
```

```
net.tls.clusterAuthX509.attributes
```

Type: string
New in version 7.0.
Specifies a set of X.509 Distinguished Name (DN) attributes and values that the server expects cluster member nodes to contain in their certificate subject names. This lets you use certificates that don't contain DC, O, and OU values to authenticate cluster members.

```

```

```

```

```

```

When attributes is set, MongoDB matches certificates using the DN and ignores extension values.

```
attributes
```

```
net.tls.clusterAuthX509.extensionValue
```

Type: string
New in version 7.0.

```
1.3.6.1.4.1.34601.2.1.2
```

```

```

```

```

```

```

When you set extensionValue, MongoDB matches certificates using certificate extension values and ignores the Distinguished Name (DN).

```
extensionValue
```

When you create a certificate with OID 1.3.6.1.4.1.34601.2.1.2, consider the following guidelines:

```
1.3.6.1.4.1.34601.2.1.2
```

- Keep the extension value below 128 bytes.
- Use a single UTF8String as the extension's inner value. mongod doesn't
accept other string types.
- If you use OpenSSL, you must explicitly specify the ASN.1 type, so it
encodes a UTF8String. For example:On the command line, specify
-addext: 1.3.6.1.4.1.34601.2.1.2=ASN1:UTF8String:<your-value>.In an OpenSSL config file, specify
1.3.6.1.4.1.34601.2.1.2 = ASN1:UTF8String:<your-value>.WarningIf you omit ASN1:UTF8String:, OpenSSL might choose a different
encoding or raw octets, which mongod rejects with an "Unsupported
tag" or "Unknown DER" tag.
- On the command line, specify
-addext: 1.3.6.1.4.1.34601.2.1.2=ASN1:UTF8String:<your-value>.
- In an OpenSSL config file, specify
1.3.6.1.4.1.34601.2.1.2 = ASN1:UTF8String:<your-value>.
Keep the extension value below 128 bytes.
Use a single UTF8String as the extension's inner value. mongod doesn't accept other string types.

```
mongod
```

If you use OpenSSL, you must explicitly specify the ASN.1 type, so it encodes a UTF8String. For example:
- On the command line, specify
-addext: 1.3.6.1.4.1.34601.2.1.2=ASN1:UTF8String:<your-value>.
- In an OpenSSL config file, specify
1.3.6.1.4.1.34601.2.1.2 = ASN1:UTF8String:<your-value>.
On the command line, specify -addext: 1.3.6.1.4.1.34601.2.1.2=ASN1:UTF8String:<your-value>.

```
-addext: 1.3.6.1.4.1.34601.2.1.2=ASN1:UTF8String:<your-value>
```

In an OpenSSL config file, specify 1.3.6.1.4.1.34601.2.1.2 = ASN1:UTF8String:<your-value>.

```
1.3.6.1.4.1.34601.2.1.2 = ASN1:UTF8String:<your-value>
```

If you omit ASN1:UTF8String:, OpenSSL might choose a different encoding or raw octets, which mongod rejects with an "Unsupported tag" or "Unknown DER" tag.

```
ASN1:UTF8String:
```

```
mongod
```

```
net.tls.CAFile
```

Type: string
The .pem file that contains the root certificate chain from the Certificate Authority. Specify the file name of the .pem file using relative or absolute paths.

```
.pem
```

```
.pem
```

- net.tls.certificateSelector

```
net.tls.certificateSelector
```

- net.tls.clusterCertificateSelector

```
net.tls.clusterCertificateSelector
```

- net.tls.CAFile

```
net.tls.CAFile
```

- net.tls.certificateSelector

```
net.tls.certificateSelector
```

- net.tls.clusterCertificateSelector

```
net.tls.clusterCertificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.clusterCAFile
```

Type: string
The .pem file that contains the root certificate chain from the Certificate Authority used to validate the certificate presented by a client establishing a connection. Specify the file name of the .pem file using relative or absolute paths. [net.tls.clusterCAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCAFile) requires that [net.tls.CAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CAFile) is set.

```
.pem
```

```
.pem
```

```
net.tls.clusterCAFile
```

```
net.tls.CAFile
```

If [net.tls.clusterCAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCAFile) does not specify the .pem file for validating the certificate from a client establishing a connection, the cluster uses the .pem file specified in the [net.tls.CAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CAFile) option.

```
net.tls.clusterCAFile
```

```
.pem
```

```
.pem
```

```
net.tls.CAFile
```

[net.tls.clusterCAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCAFile) lets you use separate Certificate Authorities to verify the client to server and server to client portions of the TLS handshake.

```
net.tls.clusterCAFile
```

Starting in 4.0, on macOS or Windows, you can use a certificate from the operating system's secure store instead of a PEM key file. See [net.tls.clusterCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCertificateSelector). When using the secure store, you do not need to, but can, also specify the [net.tls.clusterCAFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.clusterCAFile)

```
net.tls.clusterCertificateSelector
```

```
net.tls.clusterCAFile
```

- net.tls.certificateSelector

```
net.tls.certificateSelector
```

- net.tls.clusterCertificateSelector

```
net.tls.clusterCertificateSelector
```

- net.tls.clusterCAFile

```
net.tls.clusterCAFile
```

- net.tls.certificateSelector

```
net.tls.certificateSelector
```

- net.tls.clusterCertificateSelector

```
net.tls.clusterCertificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.CRLFile
```

Type: string
The .pem file that contains the Certificate Revocation List. Specify the file name of the .pem file using relative or absolute paths.

```
.pem
```

```
.pem
```

- You cannot specify [net.tls.CRLFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CRLFile) on macOS. Instead, you can
use the system SSL certificate store, which uses OCSP (Online
Certificate Status Protocol) to validate the revocation status
of certificates. See [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) to use the
system SSL certificate store.
- To check for certificate revocation, MongoDB
[enables](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.ocspEnabled) the use of OCSP
(Online Certificate Status Protocol) by default as an alternative
to specifying a CRL file or using the system SSL certificate
store.
You cannot specify [net.tls.CRLFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CRLFile) on macOS. Instead, you can use the system SSL certificate store, which uses OCSP (Online Certificate Status Protocol) to validate the revocation status of certificates. See [net.tls.certificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.certificateSelector) to use the system SSL certificate store.

```
net.tls.CRLFile
```

```
net.tls.certificateSelector
```

To check for certificate revocation, MongoDB [enables](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.ocspEnabled) the use of OCSP (Online Certificate Status Protocol) by default as an alternative to specifying a CRL file or using the system SSL certificate store.

```
enables
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.allowConnectionsWithoutCertificates
```

Type: boolean
Default: false
If false, all clients must provide client TLS certificates. If true, clients don't need to provide client certificates, but [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) encrypts the TLS/SSL connection.

```
false
```

```
true
```

```
mongod
```

```
mongos
```

If a client provides a client certificate, regardless of what value you set for net.tls.allowConnectionsWithoutCertificates, [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod performs certificate validation using the root certificate chain specified by [CAFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.CAFile), or the system CA store if [tlsUseSystemCA](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.tlsUseSystemCA) is true, and rejects clients with invalid certificates.

```
net.tls.allowConnectionsWithoutCertificates
```

```
mongos
```

```
mongod
```

```
CAFile
```

```
tlsUseSystemCA
```

```
true
```

Use the [net.tls.allowConnectionsWithoutCertificates](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.allowConnectionsWithoutCertificates) option if you have a mixed deployment that includes clients that do not or cannot present certificates to the [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
net.tls.allowConnectionsWithoutCertificates
```

```
mongos
```

```
mongod
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
net.tls.allowInvalidCertificates
```

Type: boolean
Default: false
Enable or disable the validation checks for TLS certificates on other servers in the cluster and allows the use of invalid certificates to connect.

If you specify --tlsAllowInvalidCertificates or tls.allowInvalidCertificates: true when using X.509 authentication, an invalid certificate is only sufficient to establish a TLS connection but is insufficient for authentication.

```
--tlsAllowInvalidCertificates
```

```
tls.allowInvalidCertificates: true
```

When using the net.tls.allowInvalidCertificates setting, MongoDB logs a warning regarding the use of the invalid certificate.

```
net.tls.allowInvalidCertificates
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/#std-label-configure-mongod-mongos-for-tls-ssl) and [Self-Managed Internal/Membership Authentication.](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-inter-process-auth)

```
net.tls.allowInvalidHostnames
```

Type: boolean
Default: false
When net.tls.allowInvalidHostnames is true, MongoDB disables the validation of the hostnames in TLS certificates. This allows [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) to connect to other MongoDB instances in the cluster, even if the hostname of their certificates does not match the specified hostname.

```
net.tls.allowInvalidHostnames
```

```
true
```

```
mongod
```

```
mongos
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments.](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/#std-label-configure-mongod-mongos-for-tls-ssl)

```
net.tls.disabledProtocols
```

Type: string
Prevents a MongoDB server running with TLS from accepting incoming connections that use a specific protocol or protocols. To specify multiple protocols, use a comma separated list of protocols, but do not use spaces after the commas. If you include a space before a protocol name, the server interprets it as an unrecognized protocol and doesn't start.
[net.tls.disabledProtocols](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.disabledProtocols) recognizes the following protocols: TLS1_0, TLS1_1, TLS1_2, and TLS1_3.

```
net.tls.disabledProtocols
```

```
TLS1_0
```

```
TLS1_1
```

```
TLS1_2
```

```
TLS1_3
```

- On macOS, you cannot disable TLS1_1 and leave both TLS1_0 and
TLS1_2 enabled. You must disable at least one of the other
two, for example, TLS1_0,TLS1_1.
- To list multiple protocols, specify as a comma separated list of
protocols without spaces after the commas. For example TLS1_0,TLS1_1.
- Specifying an unrecognized protocol or including a space after a
comma prevents the server from starting.
- The specified disabled protocols overrides any default disabled
protocols.
On macOS, you cannot disable TLS1_1 and leave both TLS1_0 and TLS1_2 enabled. You must disable at least one of the other two, for example, TLS1_0,TLS1_1.

```
TLS1_1
```

```
TLS1_0
```

```
TLS1_2
```

```
TLS1_0,TLS1_1
```

To list multiple protocols, specify as a comma separated list of protocols without spaces after the commas. For example TLS1_0,TLS1_1.

```
TLS1_0,TLS1_1
```

Specifying an unrecognized protocol or including a space after a comma prevents the server from starting.
The specified disabled protocols overrides any default disabled protocols.
MongoDB disables the use of TLS 1.0 if TLS 1.1+ is available on the system. To enable TLS 1.0, specify none to [net.tls.disabledProtocols.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.disabledProtocols)

```
none
```

```
net.tls.disabledProtocols
```

Members of replica sets and sharded clusters must speak at least one protocol in common.

## Tip

```
net.tls.FIPSMode
```

Type: boolean
Default: false
Enable or disable the use of the FIPS mode of the TLS library for the [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod. Your system must have a FIPS compliant library to use the [net.tls.FIPSMode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.FIPSMode) option.

```
mongos
```

```
mongod
```

```
net.tls.FIPSMode
```

## Note

```
net.tls.logVersions
```

Type: string
Instructs [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod to log a message when a client connects using a specified TLS version.

```
mongos
```

```
mongod
```

Specify either a single TLS version or a comma-separated list of multiple TLS versions.

## Example
To instruct [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod to log a message when a client connects using either TLS 1.2 or TLS 1.3, set [net.tls.logVersions](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.logVersions) to "TLS1_2,TLS1_3".

```
mongos
```

```
mongod
```

```
net.tls.logVersions
```

```
"TLS1_2,TLS1_3"
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#net.compression-optionnet.compression Option

```
net.compression
```

```
net: compression: compressors: <string>
```

```
net: compression: compressors: <string>
```

```
net.compression.compressors
```

Default: snappy,zstd,zlib
Specifies the default compressor(s) to use for communication between this [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance and:

```
mongod
```

```
mongos
```

- other members of the deployment if the instance is part of a replica set or a sharded cluster
- [mongosh](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)
- drivers that support the OP_COMPRESSED message format.
other members of the deployment if the instance is part of a replica set or a sharded cluster

```
mongosh
```

drivers that support the OP_COMPRESSED message format.

```
OP_COMPRESSED
```

MongoDB supports the following compressors:
- [snappy](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-snappy)
- [zlib](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zlib)
- [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd)
- snappy
To disable network compression, set the value to disabled.

```
disabled
```

Messages are compressed when both parties enable network compression. Otherwise, messages between the parties are uncompressed.
If you specify multiple compressors, then the order in which you list the compressors matter as well as the communication initiator. For example, if [[mongosh](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh) specifies the following network compressors zlib,snappy and the mongod specifies snappy,zlib, messages between mongosh and mongod uses zlib.

```
mongosh
```

```
zlib,snappy
```

```
mongod
```

```
snappy,zlib
```

```
mongosh
```

```
mongod
```

```
zlib
```

If the parties do not share at least one common compressor, messages between the parties are uncompressed. For example, if [[mongosh](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh) specifies the network compressor zlib and mongod specifies snappy, messages between mongosh and mongod are not compressed.

```
mongosh
```

```
zlib
```

```
mongod
```

```
snappy
```

```
mongosh
```

```
mongod
```

```
security
```

```
security: keyFile: <string> clusterAuthMode: <string> authorization: <string> transitionToAuth: <boolean> javascriptEnabled: <boolean> redactClientLogData: <boolean> clusterIpSourceAllowlist: - <string> sasl: hostName: <string> serviceName: <string> saslauthdSocketPath: <string> enableEncryption: <boolean> encryptionCipherMode: <string> encryptionKeyFile: <string> kmip: keyIdentifier: <string> rotateMasterKey: <boolean> serverName: <string> port: <string> clientCertificateFile: <string> clientCertificatePassword: <string> clientCertificateSelector: <string> serverCAFile: <string> connectRetries: <int> connectTimeoutMS: <int> ldap: servers: <string> bind: method: <string> saslMechanisms: <string> queryUser: <string> queryPassword: <string | array> useOSDefaults: <boolean> transportSecurity: <string> timeoutMS: <int> userToDNMapping: <string> authz: queryTemplate: <string> validateLDAPServerConfig: <boolean>
```

```
security: keyFile: <string> clusterAuthMode: <string> authorization: <string> transitionToAuth: <boolean> javascriptEnabled: <boolean> redactClientLogData: <boolean> clusterIpSourceAllowlist: - <string> sasl: hostName: <string> serviceName: <string> saslauthdSocketPath: <string> enableEncryption: <boolean> encryptionCipherMode: <string> encryptionKeyFile: <string> kmip: keyIdentifier: <string> rotateMasterKey: <boolean> serverName: <string> port: <string> clientCertificateFile: <string> clientCertificatePassword: <string> clientCertificateSelector: <string> serverCAFile: <string> connectRetries: <int> connectTimeoutMS: <int> ldap: servers: <string> bind: method: <string> saslMechanisms: <string> queryUser: <string> queryPassword: <string | array> useOSDefaults: <boolean> transportSecurity: <string> timeoutMS: <int> userToDNMapping: <string> authz: queryTemplate: <string> validateLDAPServerConfig: <boolean>
```

```
security.keyFile
```

Type: string
The path to a key file that stores the shared secret that MongoDB instances use to authenticate to each other in a [sharded cluster](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-sharded-cluster) or [replica set](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-replica-set). [keyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.keyFile) implies [security.authorization](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.authorization). See [Self-Managed Internal/Membership Authentication](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-inter-process-auth) for more information.

```
keyFile
```

```
security.authorization
```

[Keyfiles for internal membership authentication](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-internal-auth-keyfile) use YAML format to allow for multiple keys in a keyfile. The YAML format accepts either:
- A single key string (same as in earlier versions)
- A sequence of key strings
A single key string (same as in earlier versions)
A sequence of key strings
The YAML format is compatible with the existing single-key keyfiles that use the text file format.

```
security.clusterAuthMode
```

Type: string
Default: keyFile
The authentication mode used for cluster authentication. If you use [internal X.509 authentication](https://www.mongodb.com/docs/manual/tutorial/configure-x509-member-authentication/#std-label-x509-internal-authentication), specify so here. This option can have one of the following values:
keyFile

```
keyFile
```

Use a keyfile for authentication. Accept only keyfiles.
sendKeyFile

```
sendKeyFile
```

For rolling upgrade purposes. Send a keyfile for authentication but can accept both keyfiles and X.509 certificates.
sendX509

```
sendX509
```

For rolling upgrade purposes. Send the X.509 certificate for authentication but can accept both keyfiles and X.509 certificates.
x509

```
x509
```

Recommended. Send the X.509 certificate for authentication and accept only X.509 certificates.
If --tlsCAFile or tls.CAFile is not specified and you are not using X.509 authentication, you must set the [tlsUseSystemCA](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.tlsUseSystemCA) parameter to true. This makes MongoDB use the system-wide CA certificate store when connecting to a TLS-enabled server.

```
--tlsCAFile
```

```
tls.CAFile
```

```
tlsUseSystemCA
```

```
true
```

If using X.509 authentication, --tlsCAFile or tls.CAFile must be specified unless using [--tlsCertificateSelector.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--tlsCertificateSelector)

```
--tlsCAFile
```

```
tls.CAFile
```

```
--tlsCertificateSelector
```

For more information about TLS and MongoDB, see [Configure MongoDB Instances for TLS/SSL on Self-Managed Deployments](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/) and [TLS/SSL Configuration for Clients](https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/) .

```
security.authorization
```

Type: string
Default: disabled
Enable or disable Role-Based Access Control (RBAC) to govern each user's access to database resources and operations.
Set this option to one of the following:
enabled

```
enabled
```

A user can access only the database resources and actions for which they have been granted privileges.
disabled

```
disabled
```

A user can access any database and perform any action.
See [Role-Based Access Control in Self-Managed Deployments](https://www.mongodb.com/docs/manual/core/authorization/) for more information.
The [security.authorization](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.authorization) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
security.authorization
```

```
mongod
```

```
security.transitionToAuth
```

Type: boolean
Default: false
Allows the [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) to accept and create authenticated and non-authenticated connections to and from other mongod and mongos instances in the deployment. Used for performing rolling transition of replica sets or sharded clusters from a no-auth configuration to [[internal authentication](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-inter-process-auth)](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-inter-process-auth). Requires specifying a internal authentication mechanism such as [security.keyFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.keyFile)

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
security.keyFile
```

For example, if using [keyfiles](https://www.[[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/security-internal-authentication/#std-label-internal-auth-keyfile) for [internal authentication](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-inter-process-auth), the mongod or [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) creates an authenticated connection with any mongod or mongos in the deployment using a matching keyfile. If the security mechanisms do not match, the mongod or mongos utilizes a non-authenticated connection instead.

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

A [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) running with [security.transitionToAuth](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.transitionToAuth) does not enforce [user access controls](https://www.mongodb.com/docs/manual/core/authorization/#std-label-authorization). Users may connect to your deployment without any access control checks and perform read, write, and administrative operations.

```
mongod
```

```
mongos
```

```
security.transitionToAuth
```

A [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) running with [internal authentication](https://www.mongodb.com/docs/manual/core/security-internal-authentication/#std-label-inter-process-auth) and without [security.transitionToAuth](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.transitionToAuth) requires clients to connect using [[user](https://www.mongodb.com/docs/manual/core/security-users/#std-label-users) access controls](https://www.mongodb.com/docs/manual/core/authorization/#std-label-authorization). Update clients to connect to the mongod or mongos using the appropriate user prior to restarting mongod or mongos without [security.transitionToAuth.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.transitionToAuth)

```
mongod
```

```
mongos
```

```
security.transitionToAuth
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
security.transitionToAuth
```

```
security.javascriptEnabled
```

Type: boolean
Default: true

Starting in MongoDB 8.0, server-side JavaScript functions ([$accumulator](https://www.mongodb.com/docs/manual/reference/operator/aggregation/accumulator/#mongodb-group-grp.-accumulator), [$function](https://www.mongodb.com/docs/manual/reference/operator/aggregation/function/#mongodb-expression-exp.-function), [$where](https://www.mongodb.com/docs/manual/reference/operator/query/where/#mongodb-query-op.-where)) are deprecated. MongoDB logs a warning when you run these functions.

```
$accumulator
```

```
$function
```

```
$where
```

[Map-reduce](https://www.mongodb.com/docs/manual/core/map-reduce/#std-label-map-reduce) is deprecated starting in MongoDB 5.0.
Enables or disables [server-side JavaScript execution](https://www.mongodb.com/docs/manual/core/server-side-javascript/). When disabled, you cannot use operations that perform server-side execution of JavaScript code, such as the [$where](https://www.mongodb.com/docs/manual/reference/operator/query/where/#mongodb-query-op.-where) query operator, [mapReduce](https://www.mongodb.com/docs/manual/reference/command/mapReduce/#mongodb-dbcommand-dbcmd.mapReduce) command, [$accumulator](https://www.mongodb.com/docs/manual/reference/operator/aggregation/accumulator/#mongodb-group-grp.-accumulator), and [$function.](https://www.mongodb.com/docs/manual/reference/operator/aggregation/function/#mongodb-expression-exp.-function)

```
$where
```

```
mapReduce
```

```
$accumulator
```

```
$function
```

If you do not use these operations, disable server-side scripting.
The [security.javascriptEnabled](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.javascriptEnabled) is available for both mongod and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos). In earlier versions, the setting is only available for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
security.javascriptEnabled
```

```
mongod
```

```
mongos
```

```
mongod
```

```
security.redactClientLogData
```

Type: boolean
Available in MongoDB Enterprise only.
A [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) running with [security.redactClientLogData](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.redactClientLogData) redacts any message accompanying a given log event before logging. This prevents the mongod or mongos from writing potentially sensitive data stored on the database to the diagnostic log. Metadata such as error or operation codes, line numbers, and source file names are still visible in the logs.

```
mongod
```

```
mongos
```

```
security.redactClientLogData
```

```
mongod
```

```
mongos
```

Use [security.redactClientLogData](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.redactClientLogData) in conjunction with [Encryption at Rest](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/) and [TLS/SSL (Transport Encryption)](https://www.mongodb.com/docs/manual/core/security-transport-encryption/) to assist compliance with regulatory requirements.

```
security.redactClientLogData
```

For example, a MongoDB deployment might store Personally Identifiable Information (PII) in one or more collections. The [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) logs events such as those related to CRUD operations, sharding metadata, etc. It is possible that the mongod or mongos may expose PII as a part of these logging operations. A mongod or mongos running with [security.redactClientLogData](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.redactClientLogData) removes any message accompanying these events before being output to the log, effectively removing the PII.

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
security.redactClientLogData
```

Diagnostics on a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) running with [[security.redactClientLogData](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.redactClientLogData)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.redactClientLogData) may be more difficult due to the lack of data related to a log event. See the [process logging](https://www.mongodb.com/docs/manual/administration/monitoring/#std-label-monitoring-log-redaction) manual page for an example of the effect of security.redactClientLogData on log output.

```
mongod
```

```
mongos
```

```
security.redactClientLogData
```

```
security.redactClientLogData
```

On a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), use [setParameter](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter) with the [redactClientLogData](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.redactClientLogData) parameter to configure this setting.

```
mongod
```

```
mongos
```

```
setParameter
```

```
redactClientLogData
```

```
security.clusterIpSourceAllowlist
```

Type: list
New in version 5.0.
Changed in version 5.2.
A list of IP addresses/CIDR ([Classless Inter-Domain Routing](https://tools.ietf.org/html/rfc4632)) ranges against which the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) validates authentication requests from other members of the replica set and, if part of a sharded cluster, the [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances. The mongod verifies that the originating IP is either explicitly in the list or belongs to a CIDR range in the list. If the IP address is not present, the server does not authenticate the mongod or mongos.

```
mongod
```

```
mongos
```

```
mongod
```

```
mongod
```

```
mongos
```

security.clusterIpSourceAllowlist has no effect on a mongod started without [authentication.](https://www.mongodb.com/docs/manual/core/authentication/#std-label-authentication)

```
security.clusterIpSourceAllowlist
```

```
mongod
```

Starting in MongoDB 5.2, you can configure security.clusterIpSourceAllowlist on a running mongod or mongos using [setParameter.](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter)

```
security.clusterIpSourceAllowlist
```

```
mongod
```

```
mongos
```

```
setParameter
```

This example updates security.clusterIpSourceAllowlist during runtime to include the IP addresses "1.1.1.1/24", "2.2.2.2/16", and "3.3.3.3".

```
security.clusterIpSourceAllowlist
```

```
"1.1.1.1/24"
```

```
"2.2.2.2/16"
```

```
"3.3.3.3"
```

```
db.adminCommand( { setParameter: 1, "clusterIpSourceAllowlist": ["1.1.1.1/24", "2.2.2.2/16", "3.3.3.3"]} );
```

```
db.adminCommand( { setParameter: 1, "clusterIpSourceAllowlist": ["1.1.1.1/24", "2.2.2.2/16", "3.3.3.3"]} );
```

This example updates security.clusterIpSourceAllowlist during runtime to exclude all IP addresses:

```
security.clusterIpSourceAllowlist
```

```
db.adminCommand( { setParameter: 1, "clusterIpSourceAllowlist": null} );
```

```
db.adminCommand( { setParameter: 1, "clusterIpSourceAllowlist": null} );
```

security.clusterIpSourceAllowlist has no effect on a mongod started without [authentication.](https://www.mongodb.com/docs/manual/core/authentication/#std-label-authentication)

```
security.clusterIpSourceAllowlist
```

```
mongod
```

security.clusterIpSourceAllowlist requires specifying each IPv4/6 address or Classless Inter-Domain Routing ([CIDR](https://tools.ietf.org/html/rfc4632)) range as a YAML list:

```
security.clusterIpSourceAllowlist
```

```
security: clusterIpSourceAllowlist: - 192.0.2.0/24 - 127.0.0.1 - ::1
```

```
security: clusterIpSourceAllowlist: - 192.0.2.0/24 - 127.0.0.1 - ::1
```

Ensure security.clusterIpSourceAllowlist includes the IP address or CIDR ranges that include the IP address of each replica set member or mongos in the deployment to ensure healthy communication between cluster components.

```
security.clusterIpSourceAllowlist
```

```
mongos
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#key-management-configuration-optionsKey Management Configuration Options

```
security: enableEncryption: <boolean> encryptionCipherMode: <string> encryptionKeyFile: <string> kmip: keyIdentifier: <string> rotateMasterKey: <boolean> serverName: <string> port: <int> clientCertificateFile: <string> clientCertificatePassword: <string> clientCertificateSelector: <string> serverCAFile: <string> connectRetries: <int> connectTimeoutMS: <int> activateKeys: <boolean> keyStatePollingSeconds: <int> useLegacyProtocol: <boolean>
```

```
security: enableEncryption: <boolean> encryptionCipherMode: <string> encryptionKeyFile: <string> kmip: keyIdentifier: <string> rotateMasterKey: <boolean> serverName: <string> port: <int> clientCertificateFile: <string> clientCertificatePassword: <string> clientCertificateSelector: <string> serverCAFile: <string> connectRetries: <int> connectTimeoutMS: <int> activateKeys: <boolean> keyStatePollingSeconds: <int> useLegacyProtocol: <boolean>
```

```
security.enableEncryption
```

Type: boolean
Default: false
Enables encryption for the WiredTiger storage engine. You must set to true to pass in encryption keys and configurations.

```
true
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.encryptionCipherMode
```

Type: string
Default: AES256-CBC

```
AES256-CBC
```

The cipher mode to use for encryption at rest:
AES256-CBC

```
AES256-CBC
```

256-bit Advanced Encryption Standard in Cipher Block Chaining Mode
AES256-GCM

```
AES256-GCM
```

256-bit Advanced Encryption Standard in Galois/Counter Mode
Available only on Linux.
MongoDB Enterprise on Windows no longer supports AES256-GCM as a block cipher for encryption at rest. This usage is only supported on Linux.

```
AES256-GCM
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.encryptionKeyFile
```

Type: string
The path to the local keyfile when managing keys through a process other than KMIP. Only set when managing keys through a process other than KMIP. If data is already encrypted using KMIP, MongoDB throws an error.
Requires [security.enableEncryption](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.enableEncryption) to be true.

```
security.enableEncryption
```

```
true
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.keyIdentifier
```

Type: string
Unique KMIP identifier for an existing key within the KMIP server. Include to use the key associated with the identifier as the system key. You can only use the setting the first time you enable encryption for the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance. Requires [security.enableEncryption](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.enableEncryption) to be true.

```
mongod
```

```
security.enableEncryption
```

If unspecified, MongoDB requests that the KMIP server create a new key to utilize as the system key.
If the KMIP server cannot locate a key with the specified identifier or the data is already encrypted with a key, MongoDB throws an error.

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.rotateMasterKey
```

Type: boolean
Default: false
If true, rotate the master key and re-encrypt the internal keystore.

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.serverName
```

Type: string
Hostname or IP address of the KMIP server to connect to. Requires [security.enableEncryption](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.enableEncryption) to be true.

```
security.enableEncryption
```

You can specify multiple KMIP servers as a comma-separated list, for example server1.example.com,server2.example.com. On startup, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) attempts to establish a connection to each server in the order listed, and selects the first server to which it can successfully establish a connection. KMIP server selection occurs only at startup.

```
server1.example.com,server2.example.com
```

```
mongod
```

mongod verifies the connection to the KMIP server on startup.

```
mongod
```

The server name specified in [security.kmip.serverName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.serverName) must match either the Subject Alternative Name SAN or the Common Name CN on the certificate presented by the KMIP server. SAN can be a system name or an IP address.

```
security.kmip.serverName
```

```
SAN
```

```

```

```
SAN
```

If SAN is present, mongod does not try to match against CN.

```
SAN
```

```
mongod
```

```

```

If the hostname or IP address of the KMIP server does does not match either SAN or CN, mongod does not start.

```
SAN
```

```

```

```
mongod
```

Starting in MongoDB 4.2, when performing comparison of SAN, MongoDB supports comparison of DNS names or IP addresses. In previous versions, MongoDB only supports comparisons of DNS names.

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.port
```

Type: int
Default: 5696
Port number to use to communicate with the KMIP server. Requires [security.kmip.serverName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.serverName). Requires [security.enableEncryption](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.enableEncryption) to be true.

```
security.kmip.serverName
```

```
security.enableEncryption
```

If specifying multiple KMIP servers with [security.kmip.serverName](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.serverName), the mongod uses the port specified with [security.kmip.port](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.port) for all provided KMIP servers.

```
security.kmip.serverName
```

```
mongod
```

```
security.kmip.port
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.clientCertificateFile
```

Type: string
Path to the .pem file used to authenticate MongoDB to the KMIP server. The specified .pem file must contain both the TLS/SSL certificate and key.

```
.pem
```

```
.pem
```

To use this setting, you must also specify the [security.kmip.serverName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.serverName) setting.

```
security.kmip.serverName
```

Enabling encryption using a KMIP server on Windows fails when using security.kmip.clientCertificateFile and the KMIP server enforces TLS 1.2.

```
security.kmip.clientCertificateFile
```

To enable encryption at rest with KMIP on Windows, you must:
- Import the client certificate into the Windows Certificate Store.
- Use the [security.kmip.clientCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateSelector) configuration option.
Import the client certificate into the Windows Certificate Store.
Use the [security.kmip.clientCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateSelector) configuration option.

```
security.kmip.clientCertificateSelector
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.clientCertificatePassword
```

Type: string
The password to decrypt the Private Key of the Client Certificate that connects to the KMIP server. This option authenticates MongoDB to the KMIP server and requires that you provide a [--kmipClientCertificateFile.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--kmipClientCertificateFile)

```
--kmipClientCertificateFile
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.clientCertificateSelector
```

Type: string
New in version 5.0: Available on Windows and macOS as an alternative to [security.kmip.clientCertificateFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateFile)

```
security.kmip.clientCertificateFile
```

[security.kmip.clientCertificateFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateFile) and [security.kmip.clientCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateSelector) options are mutually exclusive. You can only specify one.

```
security.kmip.clientCertificateFile
```

```
security.kmip.clientCertificateSelector
```

Specifies a certificate property in order to select a matching certificate from the operating system's certificate store to authenticate MongoDB to the KMIP server.
[security.kmip.clientCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateSelector) accepts an argument of the format <property>=<value> where the property can be one of the following:

```
security.kmip.clientCertificateSelector
```

```
<property>=<value>
```

subject

```
subject
```

ASCII string
Subject name or common name on certificate
thumbprint

```
thumbprint
```

hex string
A sequence of bytes, expressed as hexadecimal, used to identify a public key by its SHA-1 digest.
The thumbprint is sometimes referred to as a fingerprint.

```
thumbprint
```

```
fingerprint
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.serverCAFile
```

Type: string
Path to CA File. Used for validating secure client connection to KMIP server.

Starting in 4.0, on macOS or Windows, you can use a certificate from the operating system's secure store instead of a PEM key file. See [security.kmip.clientCertificateSelector](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.clientCertificateSelector). When using the secure store, you do not need to, but can, also specify the [security.kmip.serverCAFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.serverCAFile)

```
security.kmip.clientCertificateSelector
```

```
security.kmip.serverCAFile
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.connectRetries
```

Type: int
Default: 0
How many times to retry the initial connection to the KMIP server. Use together with [connectTimeoutMS](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.connectTimeoutMS) to control how long the mongod waits for a response between each retry.

```
connectTimeoutMS
```

```
mongod
```

### Enterprise Feature
Available in MongoDB Enterprise only.

```
security.kmip.connectTimeoutMS
```

Type: int
Default: 5000
Timeout in milliseconds to wait for a response from the KMIP server. If the [connectRetries](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.connectRetries) setting is specified, the mongod waits up to the value specified with [connectTimeoutMS](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.connectTimeoutMS) for each retry.

```
connectRetries
```

```
mongod
```

```
connectTimeoutMS
```

Value must be 1000 or greater.

```
1000
```

Available in MongoDB Enterprise only.

```
security.kmip.activateKeys
```

Type: boolean
Default: true
New in version 5.3.
Activates all newly created KMIP keys upon creation and then periodically checks those keys are in an active state.
When security.kmip.activateKeys is true and you have existing keys on a KMIP server, the key must be activated first or the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) node fails to start.

```
security.kmip.activateKeys
```

```
true
```

```
mongod
```

If the key being used by the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) transitions into a non-active state, the mongod node shuts down unless kmipActivateKeys is false. To ensure you have an active key, rotate the KMIP master key by using [security.kmip.rotateMasterKey.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.kmip.rotateMasterKey)

```
mongod
```

```
kmipActivateKeys
```

```
security.kmip.rotateMasterKey
```

```
security.kmip.keyStatePollingSeconds
```

Type: int
Default: 900 seconds
New in version 5.3.
Frequency in seconds at which mongod polls the KMIP server for active keys.
To disable disable polling, set the value to -1.

```

```

```
security.kmip.useLegacyProtocol
```

Type: boolean
Default: false
New in version 7.0: (and 6.0.6)
When true, mongod uses KMIP protocol version 1.0 or 1.1 instead of the default version. The default KMIP protocol is version 1.2.

```
true
```

```
mongod
```

To use [audit log encryption](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/#std-label-security-encryption-at-rest-audit-log) with KMIP version 1.0 or 1.1, you must specify [auditEncryptKeyWithKMIPGet](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.auditEncryptKeyWithKMIPGet) at startup.

```
auditEncryptKeyWithKMIPGet
```

To use KMIP protocol version 1.0 or 1.1, substitute your local values and add an entry like this to your mongod configuration file:

```
mongod
```

```
```

```
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#security.sasl-optionssecurity.sasl Options

```
security.sasl
```

```
security: sasl: hostName: <string> serviceName: <string> saslauthdSocketPath: <string>
```

```
security: sasl: hostName: <string> serviceName: <string> saslauthdSocketPath: <string>
```

```
security.sasl.hostName
```

Type: string
A fully qualified server domain name for the purpose of configuring SASL and Kerberos authentication. The SASL hostname overrides the hostname only for the configuration of SASL and Kerberos.

```
security.sasl.serviceName
```

Type: string
Registered name of the service using SASL. This option allows you to override the default [[Kerberos](https://www.mongodb.com/docs/manual/tutorial/control-access-to-mongodb-with-kerberos-authentication/)](https://www.mongodb.com/docs/manual/tutorial/control-access-to-mongodb-with-kerberos-authentication/) service name component of the Kerberos principal name, on a per-instance basis. If unspecified, the default value is mongodb.

```
mongodb
```

MongoDB permits setting this option only at startup. The [setParameter](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter) can not change this setting.

```
setParameter
```

This option is available only in MongoDB Enterprise.

Ensure that your driver supports alternate service names. For [mongosh](https://www.mongodb.com/docs/mongodb-shell/#mongodb-binary-bin.mongosh) and other MongoDB tools to connect to the new [serviceName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.sasl.serviceName), see the gssapiServiceName option.

```
mongosh
```

```
serviceName
```

```
gssapiServiceName
```

```
security.sasl.saslauthdSocketPath
```

Type: string
The path to the UNIX domain socket file for saslauthd.

```
saslauthd
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#security.ldap-optionssecurity.ldap Options

```
security.ldap
```

Starting in MongoDB 8.0, LDAP authentication and authorization is deprecated. LDAP is available and will continue to operate without changes throughout the lifetime of MongoDB 8. LDAP will be removed in a future major release.
For details, see [LDAP Deprecation.](https://www.mongodb.com/docs/manual/core/LDAP-deprecation/#std-label-ldap-deprecation)

```
security: ldap: servers: <string> bind: method: <string> saslMechanisms: <string> queryUser: <string> queryPassword: <string | array> useOSDefaults: <boolean> transportSecurity: <string> timeoutMS: <int> retryCount: <int> userToDNMapping: <string> authz: queryTemplate: <string> validateLDAPServerConfig: <boolean>
```

```
security: ldap: servers: <string> bind: method: <string> saslMechanisms: <string> queryUser: <string> queryPassword: <string | array> useOSDefaults: <boolean> transportSecurity: <string> timeoutMS: <int> retryCount: <int> userToDNMapping: <string> authz: queryTemplate: <string> validateLDAPServerConfig: <boolean>
```

```
security.ldap.servers
```

Type: string
Available in MongoDB Enterprise only.
The LDAP server against which the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) authenticates users or determines what actions a user is authorized to perform on a given database. If the LDAP server specified has any replicated instances, you may specify the host and port of each replicated server in a comma-delimited list.

```
mongod
```

```
mongos
```

If your LDAP infrastructure partitions the LDAP directory over multiple LDAP servers, specify one LDAP server or any of its replicated instances to [[security.ldap.servers](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.servers)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.servers). MongoDB supports following LDAP referrals as defined in [RFC 4511 4.1.10](https://www.rfc-editor.org/rfc/rfc4511.txt). Do not use security.ldap.servers for listing every LDAP server in your infrastructure.

```
security.ldap.servers
```

```
security.ldap.servers
```

You can prefix LDAP servers with srv: and srv_raw:.

```
srv:
```

```
srv_raw:
```

If your connection string specifies "srv:<DNS_NAME>", [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) verifies that "_ldap._tcp.gc._msdcs.<DNS_NAME>" exists for SRV to support Active Directory. If not found, mongod verifies that "_ldap._tcp.<DNS_NAME>" exists for SRV. If an SRV record cannot be found, mongod warns you to use "srv_raw:<DNS_NAME>" instead.

```
"srv:<DNS_NAME>"
```

```
mongod
```

```
"_ldap._tcp.gc._msdcs.<DNS_NAME>"
```

```
mongod
```

```
"_ldap._tcp.<DNS_NAME>"
```

```
mongod
```

```
"srv_raw:<DNS_NAME>"
```

If your connection string specifies "srv_raw:<DNS_NAME>", [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) performs an SRV record lookup for "<DNS NAME>".

```
"srv_raw:<DNS_NAME>"
```

```
mongod
```

```
"<DNS NAME>"
```

This setting can be configured on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using [setParameter.](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter)

```
mongod
```

```
mongos
```

```
setParameter
```

If unset, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) cannot use [LDAP authentication or authorization.](https://www.mongodb.com/docs/manual/core/security-ldap/)

```
mongod
```

```
mongos
```

```
security.ldap.bind.queryUser
```

Type: string
Available in MongoDB Enterprise only.

The identity with which [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) binds as, when connecting to or performing queries on an LDAP server.

```
mongod
```

```
mongos
```

Only required if any of the following are true:
- Using [LDAP authorization.](https://www.mongodb.com/docs/manual/core/security-ldap-external/#std-label-security-ldap-external)
- Using an LDAP query for [security.ldap.userToDNMapping.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)
- The LDAP server disallows anonymous binds
Using [LDAP authorization.](https://www.mongodb.com/docs/manual/core/security-ldap-external/#std-label-security-ldap-external)
Using an LDAP query for [security.ldap.userToDNMapping.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)

```
security.ldap.userToDNMapping
```

The LDAP server disallows anonymous binds
You must use [queryUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser) with [queryPassword.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword)

```
queryUser
```

```
queryPassword
```

If unset, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) does not attempt to bind to the LDAP server.

```
mongod
```

```
mongos
```

This setting can be configured on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using [setParameter.](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter)

```
mongod
```

```
mongos
```

```
setParameter
```

Windows MongoDB deployments can use [[useOSDefaults](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.useOSDefaults)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.useOSDefaults) instead of [[queryUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser) and [queryPassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword). You cannot specify both queryUser and useOSDefaults at the same time.

```
useOSDefaults
```

```
queryUser
```

```
queryPassword
```

```
queryUser
```

```
useOSDefaults
```

```
security.ldap.bind.queryPassword
```

Type: string or array
Available in MongoDB Enterprise only.
The password used to bind to an LDAP server when using [queryUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser). You must use [queryPassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword) with [queryUser.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser)

```
queryUser
```

```
queryPassword
```

```
queryUser
```

If not set, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) does not attempt to bind to the LDAP server.

```
mongod
```

```
mongos
```

You can configure this setting on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using [setParameter.](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter)

```
mongod
```

```
mongos
```

```
setParameter
```

The ldapQueryPassword [setParameter](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter) command accepts either a string or an array of strings. If ldapQueryPassword is set to an array, MongoDB tries each password in order until one succeeds. Use a password array to roll over the LDAP account password without downtime.

```
ldapQueryPassword
```

```
setParameter
```

```
ldapQueryPassword
```

Windows MongoDB deployments can use [[useOSDefaults](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.useOSDefaults)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.useOSDefaults) instead of [queryUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser) and [[queryPassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword). You cannot specify both queryPassword and useOSDefaults at the same time.

```
useOSDefaults
```

```
queryUser
```

```
queryPassword
```

```
queryPassword
```

```
useOSDefaults
```

```
security.ldap.bind.useOSDefaults
```

Type: boolean
Default: false
Available in MongoDB Enterprise for the Windows platform only.
Allows [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) to authenticate, or bind, using your Windows login credentials when connecting to the LDAP server.

```
mongod
```

```
mongos
```

Only required if:
- Using [LDAP authorization.](https://www.mongodb.com/docs/manual/core/security-ldap-external/#std-label-security-ldap-external)
- Using an LDAP query for [username transformation.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)
- The LDAP server disallows anonymous binds
Using [LDAP authorization.](https://www.mongodb.com/docs/manual/core/security-ldap-external/#std-label-security-ldap-external)
Using an LDAP query for [username transformation.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)

```
username transformation
```

The LDAP server disallows anonymous binds
Use [useOSDefaults](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.useOSDefaults) to replace [queryUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser) and [queryPassword.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword)

```
useOSDefaults
```

```
queryUser
```

```
queryPassword
```

```
security.ldap.bind.method
```

Type: string
Default: simple
Available in MongoDB Enterprise only.
The method [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) uses to authenticate to an LDAP server. Use with [queryUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryUser) and [queryPassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.queryPassword) to connect to the LDAP server.

```
mongod
```

```
mongos
```

```
queryUser
```

```
queryPassword
```

[method](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.method) supports the following values:

```
method
```

- simple - [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) uses simple authentication.
- sasl - [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) uses SASL protocol for authentication
simple - [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) uses simple authentication.

```
simple
```

```
mongod
```

```
mongos
```

sasl - [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) uses SASL protocol for authentication

```
sasl
```

```
mongod
```

```
mongos
```

If you specify sasl, you can configure the available SASL mechanisms using [security.ldap.bind.saslMechanisms](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.saslMechanisms). mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) defaults to using DIGEST-MD5 mechanism.

```
sasl
```

```
security.ldap.bind.saslMechanisms
```

```
mongod
```

```
mongos
```

```
DIGEST-MD5
```

```
security.ldap.bind.saslMechanisms
```

Type: string
Default: DIGEST-MD5
Available in MongoDB Enterprise only.
A comma-separated list of SASL mechanisms [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) can use when authenticating to the LDAP server. The mongod or mongos and the LDAP server must agree on at least one mechanism. The mongod or mongos dynamically loads any SASL mechanism libraries installed on the host machine at runtime.

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

Install and configure the appropriate libraries for the selected SASL mechanism(s) on both the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) host and the remote LDAP server host. Your operating system may include certain SASL libraries by default. Defer to the documentation associated with each SASL mechanism for guidance on installation and configuration.

```
mongod
```

```
mongos
```

If using the GSSAPI SASL mechanism for use with [Kerberos Authentication on Self-Managed Deployments](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/kerberos/#std-label-security-kerberos), verify the following for the mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) host machine:

```
GSSAPI
```

```
mongod
```

```
mongos
```

```
Linux
```

- The KRB5_CLIENT_KTNAME environment
variable resolves to the name of the client [Linux Keytab Files](https://www.mongodb.com/docs/manual/core/kerberos/#std-label-keytab-files)
for the host machine. For more on Kerberos environment
variables, please defer to the
- The client keytab includes a
[User Principal](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/kerberos/#std-label-kerberos-user-principal) for the mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) to use when
connecting to the LDAP server and execute LDAP queries.
The KRB5_CLIENT_KTNAME environment variable resolves to the name of the client [Linux Keytab Files](https://www.mongodb.com/docs/manual/core/kerberos/#std-label-keytab-files) for the host machine. For more on Kerberos environment variables, please defer to the [Kerberos documentation.](https://web.mit.edu/kerberos/krb5-1.13/doc/admin/env_variables.html)

```
KRB5_CLIENT_KTNAME
```

The client keytab includes a [User Principal](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/kerberos/#std-label-kerberos-user-principal) for the mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) to use when connecting to the LDAP server and execute LDAP queries.

```
mongod
```

```
mongos
```

```
Windows
```

## Note
- useOSDefaults

```
useOSDefaults
```

```
true
```

- mongod

```
mongod
```

- mongos

```
mongos
```

Set [method](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.bind.method) to sasl to use this option.

```
method
```

```
sasl
```

## Note
For a complete list of SASL mechanisms see the [IANA listing](http://www.iana.org/assignments/sasl-mechanisms/sasl-mechanisms.xhtml). Defer to the documentation for your LDAP or Active Directory service for identifying the SASL mechanisms compatible with the service.
MongoDB is not a source of SASL mechanism libraries, nor is the MongoDB documentation a definitive source for installing or configuring any given SASL mechanism. For documentation and support, defer to the SASL mechanism library vendor or owner.
For more information on SASL, defer to the following resources:
- For Linux, please see the [Cyrus SASL documentation.](https://www.cyrusimap.org/sasl/)
- For Windows, please see the [Windows SASL documentation.](https://msdn.microsoft.com/en-us/library/cc223500.aspx)
For Linux, please see the [Cyrus SASL documentation.](https://www.cyrusimap.org/sasl/)
For Windows, please see the [Windows SASL documentation.](https://msdn.microsoft.com/en-us/library/cc223500.aspx)

```
security.ldap.transportSecurity
```

Type: string
Default: tls
Available in MongoDB Enterprise only.
By default, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) creates a TLS/SSL secured connection to the LDAP server.

```
mongod
```

```
mongos
```

For Linux deployments, you must configure the appropriate TLS Options in /etc/openldap/ldap.conf file. Your operating system's package manager creates this file as part of the MongoDB Enterprise installation, through the libldap dependency. See the documentation for TLS Options in the [ldap.conf OpenLDAP documentation](http://www.openldap.org/software/man.cgi?query=ldap.conf&manpath=OpenLDAP+2.4-Release) for more complete instructions.

```
/etc/openldap/ldap.conf
```

```
libldap
```

```
TLS Options
```

For Windows deployment, you must add the LDAP server CA certificates to the Windows certificate management tool. The exact name and functionality of the tool may vary depending on operating system version. Please see the documentation for your version of Windows for more information on certificate management.
Set [transportSecurity](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.transportSecurity) to none to disable TLS/SSL between mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) and the LDAP server.

```
transportSecurity
```

```
none
```

```
mongod
```

```
mongos
```

Setting [transportSecurity](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.transportSecurity) to none transmits plaintext information and possibly credentials between mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) and the LDAP server.

```
transportSecurity
```

```
none
```

```
mongod
```

```
mongos
```

```
security.ldap.timeoutMS
```

Type: int
Default: 10000
Available in MongoDB Enterprise only.
The amount of time in milliseconds [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) should wait for an LDAP server to respond to a request.

```
mongod
```

```
mongos
```

Increasing the value of [[timeoutMS](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.timeoutMS)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.timeoutMS) may prevent connection failure between the MongoDB server and the LDAP server, if the source of the failure is a connection timeout. Decreasing the value of timeoutMS reduces the time MongoDB waits for a response from the LDAP server.

```
timeoutMS
```

```
timeoutMS
```

This setting can be configured on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using [setParameter.](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter)

```
mongod
```

```
mongos
```

```
setParameter
```

```
security.ldap.retryCount
```

New in version 6.1.
Type: int
Default: 0
Available in MongoDB Enterprise only.
Number of operation retries by the server LDAP manager after a network error.
This setting can be configured on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using [setParameter.](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter)

```
mongod
```

```
mongos
```

```
setParameter
```

```
security.ldap.userToDNMapping
```

Type: string
Available in MongoDB Enterprise only.
Maps the username provided to [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) for authentication to a LDAP Distinguished Name (DN). You may need to use [userToDNMapping](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping) to transform a username into an LDAP DN in the following scenarios:

```
mongod
```

```
mongos
```

```
userToDNMapping
```

- Performing LDAP authentication with simple LDAP binding, where users
authenticate to MongoDB with usernames that are not full LDAP DNs.
- Using an [LDAP authorization query template](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--ldapAuthzQueryTemplate) that requires a DN.
- Transforming the usernames of clients authenticating to Mongo DB using
different authentication mechanisms (for example, X.509, kerberos) to a full LDAP
DN for authorization.
Performing LDAP authentication with simple LDAP binding, where users authenticate to MongoDB with usernames that are not full LDAP DNs.
Using an [LDAP authorization query template](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--ldapAuthzQueryTemplate) that requires a DN.

```
LDAP authorization query template
```

Transforming the usernames of clients authenticating to Mongo DB using different authentication mechanisms (for example, X.509, kerberos) to a full LDAP DN for authorization.

[userToDNMapping](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping) expects a quote-enclosed JSON-string representing an ordered array of documents. Each document contains a regular expression match and either a substitution or ldapQuery template used for transforming the incoming username.

```
userToDNMapping
```

```
match
```

```
substitution
```

```
ldapQuery
```

Each document in the array has the following form:

```
{ match: "<regex>" substitution: "<LDAP DN>" | ldapQuery: "<LDAP Query>"}
```

```
{ match: "<regex>" substitution: "<LDAP DN>" | ldapQuery: "<LDAP Query>"}
```

match

```
match
```

An ECMAScript-formatted regular expression (regex) to match against a provided username. Each parenthesis-enclosed section represents a regex capture group used by substitution or ldapQuery.

```
substitution
```

```
ldapQuery
```

"(.+)ENGINEERING" "(.+)DBA"

```
"(.+)ENGINEERING"
```

```
"(.+)DBA"
```

substitution

```
substitution
```

An LDAP distinguished name (DN) formatting template that converts the authentication name matched by the match regex into a LDAP DN. Each curly bracket-enclosed numeric value is replaced by the corresponding [regex capture group](http://www.regular-expressions.info/refcapture.html) extracted from the authentication username through the match regex.

```
match
```

```
match
```

The result of the substitution must be an [RFC4514](https://www.ietf.org/rfc/rfc4514.txt) escaped string.
"cn={0},ou=engineering, dc=example,dc=com"

```
"cn={0},ou=engineering, dc=example,dc=com"
```

ldapQuery

```
ldapQuery
```

A LDAP query formatting template that inserts the authentication name matched by the match regex into an LDAP query URI encoded respecting RFC4515 and RFC4516. Each curly bracket-enclosed numeric value is replaced by the corresponding [regex capture group](http://www.regular-expressions.info/refcapture.html) extracted from the authentication username through the match expression. [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) executes the query against the LDAP server to retrieve the LDAP DN for the authenticated user. mongod or mongos requires exactly one returned result for the transformation to be successful, or mongod or mongos skips this transformation.

```
match
```

```
match
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

"ou=engineering,dc=example, dc=com??one?(user={0})"

```
"ou=engineering,dc=example, dc=com??one?(user={0})"
```

## Note
An explanation of [RFC4514](https://www.ietf.org/rfc/rfc4514.txt), [RFC4515](https://tools.ietf.org/html/rfc4515), [RFC4516](https://tools.ietf.org/html/rfc4516), or LDAP queries is out of scope for the MongoDB Documentation. Please review the RFC directly or use your preferred LDAP resource.
For each document in the array, you must use either substitution or ldapQuery. You cannot specify both in the same document.

```
substitution
```

```
ldapQuery
```

When performing authentication or authorization, [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) steps through each document in the array in the given order, checking the authentication username against the match filter. If a match is found, mongod or mongos applies the transformation and uses the output for authenticating the user. mongod or mongos does not check the remaining documents in the array.

```
mongod
```

```
mongos
```

```
match
```

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

If the given document does not match the provided authentication name, [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) continues through the list of documents to find additional matches. If no matches are found in any document, or the transformation the document describes fails, mongod or mongos returns an error.

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) also returns an error if one of the transformations cannot be evaluated due to networking or authentication failures to the LDAP server. mongod or mongos rejects the connection request and does not check the remaining documents in the array.

```
mongod
```

```
mongos
```

```
mongod
```

```
mongos
```

Starting in MongoDB 5.0, [[userToDNMapping](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping) accepts an empty string "" or empty array [ ] in place of a mapping document. If providing an empty string or empty array to userToDNMapping, MongoDB maps the authenticated username as the LDAP DN. Previously, providing an empty mapping document would cause mapping to fail.

```
userToDNMapping
```

```

```

```
[ ]
```

```
userToDNMapping
```

## Example
The following shows two transformation documents. The first document matches against any string ending in @ENGINEERING, placing anything preceding the suffix into a regex capture group. The second document matches against any string ending in @DBA, placing anything preceding the suffix into a regex capture group.

```
@ENGINEERING
```

```
@DBA
```

```
"[ { match: "(.+)@ENGINEERING.EXAMPLE.COM", substitution: "cn={0},ou=engineering,dc=example,dc=com" }, { match: "(.+)@DBA.EXAMPLE.COM", ldapQuery: "ou=dba,dc=example,dc=com??one?(user={0})" }]"
```

```
"[ { match: "(.+)@ENGINEERING.EXAMPLE.COM", substitution: "cn={0},ou=engineering,dc=example,dc=com" }, { match: "(.+)@DBA.EXAMPLE.COM", ldapQuery: "ou=dba,dc=example,dc=com??one?(user={0})" }]"
```

A user with username alice@ENGINEERING.EXAMPLE.COM matches the first document. The regex capture group {0} corresponds to the string alice. The resulting output is the DN "cn=alice,ou=engineering,dc=example,dc=com".

```
alice@ENGINEERING.EXAMPLE.COM
```

```
{0}
```

```
alice
```

```
"cn=alice,ou=engineering,dc=example,dc=com"
```

A user with username bob@DBA.EXAMPLE.COM matches the second document. The regex capture group {0} corresponds to the string bob. The resulting output is the LDAP query "ou=dba,dc=example,dc=com??one?(user=bob)". [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) executes this query against the LDAP server, returning the result "cn=bob,ou=dba,dc=example,dc=com".

```
bob@DBA.EXAMPLE.COM
```

```
{0}
```

```
bob
```

```
"ou=dba,dc=example,dc=com??one?(user=bob)"
```

```
mongod
```

```
mongos
```

```
"cn=bob,ou=dba,dc=example,dc=com"
```

If [userToDNMapping](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping) is unset, mongod or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) applies no transformations to the username when attempting to authenticate or authorize a user against the LDAP server.

```
userToDNMapping
```

```
mongod
```

```
mongos
```

This setting can be configured on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) using the [setParameter](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter) database command.

```
mongod
```

```
mongos
```

```
setParameter
```

```
security.ldap.authz.queryTemplate
```

Type: string
Available in MongoDB Enterprise only.
A relative LDAP query URL formatted conforming to [RFC4515](https://tools.ietf.org/html/rfc4515) and [RFC4516](https://tools.ietf.org/html/rfc4516) that [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) executes to obtain the LDAP groups to which the authenticated user belongs to. The query is relative to the host or hosts specified in [security.ldap.servers.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.servers)

```
mongod
```

```
security.ldap.servers
```

## Note
For better performance, consider placing the LDAP groups used for MongoDB authorization into their own Organizational Unit (OU).

```

```

In the URL, you can use the following substitution tokens:
{USER}

```
{USER}
```

Substitutes the authenticated username, or the [transformed](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.[userToDNMapping](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)) username if a userToDNMapping is specified.

```
transformed
```

```
userToDNMapping
```

{PROVIDED_USER}

```
{PROVIDED_USER}
```

Substitutes the supplied username, i.e. before either authentication or [LDAP transformation.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.userToDNMapping)

```
LDAP transformation
```

When constructing the query URL, ensure that the order of LDAP parameters respects RFC4516:

```
[ dn [ ? [attributes] [ ? [scope] [ ? [filter] [ ? [Extensions] ] ] ] ] ]
```

```
[ dn [ ? [attributes] [ ? [scope] [ ? [filter] [ ? [Extensions] ] ] ] ] ]
```

If your query includes an attribute, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) assumes that the query retrieves a list of the DNs which this entity is a member of.

```
mongod
```

If your query does not include an attribute, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) assumes the query retrieves all entities which the user is member of.

```
mongod
```

For each LDAP DN returned by the query, [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) assigns the authorized user a corresponding role on the admin database. If a role on the on the admin database exactly matches the DN, mongod grants the user the roles and privileges assigned to that role. See the [db.createRole()](https://www.mongodb.com/docs/manual/reference/method/db.createRole/#mongodb-method-db.createRole) method for more information on creating roles.

```
mongod
```

```
admin
```

```
admin
```

```
mongod
```

```
db.createRole()
```

## Example
This LDAP query returns any groups listed in the LDAP user object's memberOf attribute.

```
memberOf
```

```
"{USER}?memberOf?base"
```

```
"{USER}?memberOf?base"
```

Your LDAP configuration may not include the memberOf attribute as part of the user schema, may possess a different attribute for reporting group membership, or may not track group membership through attributes. Configure your query with respect to your own unique LDAP configuration.

```
memberOf
```

If unset, [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) cannot authorize users using LDAP.

```
mongod
```

Although you can modify the value of the ldapAuthzQueryTemplate parameter on a running [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) by using the [setParameter](https://www.mongodb.com/docs/manual/reference/command/setParameter/#mongodb-dbcommand-dbcmd.setParameter) database command, you can't enable or disable it during runtime. To enable this setting, you must configure security.ldap.authz.queryTemplate in your configuration file during startup.

```
ldapAuthzQueryTemplate
```

```
mongod
```

```
setParameter
```

```
security.ldap.authz.queryTemplate
```

An explanation of [RFC4515](https://tools.ietf.org/html/rfc4515), [RFC4516](https://tools.ietf.org/html/rfc4516) or LDAP queries is out of scope for the MongoDB Documentation. Please review the RFC directly or use your preferred LDAP resource.

```
security.ldap.validateLDAPServerConfig
```

Type: boolean
Default: true
Available in MongoDB Enterprise
A flag that determines if the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance checks the availability of the [LDAP server(s)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.ldap.servers) as part of its startup:

```
mongod
```

```
mongos
```

```
LDAP server(s)
```

- If true, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)
instance performs the availability check and only continues to
start up if the LDAP server is available.
- If false, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)
instance skips the availability check; i.e. the instance starts up
even if the LDAP server is unavailable.
If true, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance performs the availability check and only continues to start up if the LDAP server is available.

```
true
```

```
mongod
```

```
mongos
```

If false, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance skips the availability check; i.e. the instance starts up even if the LDAP server is unavailable.

```
false
```

```
mongod
```

```
mongos
```

### https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-optionsetParameter Option
```
setParameter
```

```
setParameter
```

Set MongoDB parameter or parameters described in [MongoDB Server Parameters for a Self-Managed Deployment](https://www.mongodb.com/docs/manual/reference/parameters/)
To set parameters in the YAML configuration file, use the following format:

```
setParameter: <parameter1>: <value1> <parameter2>: <value2>
```

```
setParameter: <parameter1>: <value1> <parameter2>: <value2>
```

For example, to specify the [enableLocalhostAuthBypass](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.enableLocalhostAuthBypass) in the configuration file:

```
enableLocalhostAuthBypass
```

```
setParameter: enableLocalhostAuthBypass: false
```

```
setParameter: enableLocalhostAuthBypass: false
```

### https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-ldap-optionssetParameter LDAP Options
```
setParameter
```

```
setParameter.ldapUserCacheInvalidationInterval
```

Type: int
Default: 30
For use with [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) servers using [LDAP Authorization on Self-Managed Deployments.](https://www.mongodb.com/docs/manual/core/security-ldap-external/#std-label-security-ldap-external)

```
mongod
```

The interval (in seconds) [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) waits between external user cache flushes. After mongod flushes the external user cache, MongoDB reacquires authorization data from the LDAP server the next time an LDAP-authorized user issues an operation.

```
mongod
```

```
mongod
```

Increasing the value specified increases the amount of time [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and the LDAP server can be out of sync, but reduces the load on the LDAP server. Conversely, decreasing the value specified decreases the time mongod and the LDAP server can be out of sync while increasing the load on the LDAP server.

```
mongod
```

```
mongod
```

```
setParameter: ldapUserCacheInvalidationInterval: <int>
```

```
setParameter: ldapUserCacheInvalidationInterval: <int>
```

### https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-mongodb-search-optionssetParameter MongoDB Search Options
```
setParameter
```

```
setParameter.searchIndexManagementHostAndPort
```

Type: string
Default: ""
Search index management host address. This parameter specifies the hostname or IP address and port for the search index management server.

## Note
This parameter must have the same value as [setParameter.mongotHost.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-setParameter.mongotHost)

```
setParameter.mongotHost
```

```
setParameter: searchIndexManagementHostAndPort: <hostname|IP:port>
```

```
setParameter: searchIndexManagementHostAndPort: <hostname|IP:port>
```

## Example
```
setParameter: searchIndexManagementHostAndPort: localhost:27028
```

```
setParameter: searchIndexManagementHostAndPort: localhost:27028
```

```
setParameter.skipAuthenticationToSearchIndexManagementServer
```

Type: boolean
Default: false
Flag that determines whether or not to skip authentication for mongod for server to index management server connections, even if authentication is enabled on mongod.

```
mongod
```

```
mongod
```

## Note
As a security best practice, we recommend setting this parameter to false.

```
false
```

```
setParameter: skipAuthenticationToSearchIndexManagementServer: <true|false>
```

```
setParameter: skipAuthenticationToSearchIndexManagementServer: <true|false>
```

```
setParameter.mongotHost
```

Type: string
Default: ""
mongot host address. This parameter specifies the hostname or IP address and port for the mongot server.

```
mongot
```

```
mongot
```

## Note
This parameter must have the same value as [setParameter.searchIndexManagementHostAndPort.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-setParameter.searchIndexManagementHostAndPort)

```
setParameter.searchIndexManagementHostAndPort
```

```
setParameter: mongotHost: <hostname|IP:port>
```

```
setParameter: mongotHost: <hostname|IP:port>
```

## Example
```
setParameter: mongotHost: localhost:27028
```

```
setParameter: mongotHost: localhost:27028
```

```
setParameter.skipAuthenticationToMongot
```

Type: boolean
Default: false
Specifies whether MongoDB skips authentication for mongod to mongot connections, even if authentication is enabled on mongod.

```
mongod
```

```
mongot
```

```
mongod
```

## Note
As a security best practice, we recommend leaving this parameter unset or setting it to false.

```
false
```

```
setParameter: skipAuthenticationToMongot: <true|false>
```

```
setParameter: skipAuthenticationToMongot: <true|false>
```

```
setParameter.useGrpcForSearch
```

Type: boolean
Default: false
Specifies whether or not shards should communicate with mongot using gRPC.

```
mongot
```

## Note
You must set this parameter to true if you're using mongot.

```
true
```

```
mongot
```

```
setParameter: useGrpcForSearch: <true|false>
```

```
setParameter: useGrpcForSearch: <true|false>
```

```
setParameter.searchTLSMode
```

Type: string
Default: globalTLS

```
globalTLS
```

Sets the TLS mode for mongod to mongot connection. Setting the globalTLS value uses the setting that you specified in [net.tls.mode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.tls.mode), while the other settings operate according to their usual behavior.

```
mongod
```

```
mongot
```

```
globalTLS
```

```
net.tls.mode
```

You can use the following values for this parameter:
- globalTLS
- disabled
- allowTLS
- preferTLS
- requireTLS
globalTLS

```
globalTLS
```

disabled

```
disabled
```

allowTLS

```
allowTLS
```

preferTLS

```
preferTLS
```

requireTLS

```
requireTLS
```

```
setParameter: searchTLSMode: <globalTLS|disabled|allowTLS|preferTLS|requireTLS>
```

```
setParameter: searchTLSMode: <globalTLS|disabled|allowTLS|preferTLS|requireTLS>
```

```
storage
```

Changed in version 6.1:
- MongoDB always enables journaling. As a result, MongoDB removes the
storage.journal.enabled option and the corresponding --journal and
--nojournal command-line options.
MongoDB always enables journaling. As a result, MongoDB removes the storage.journal.enabled option and the corresponding --journal and --nojournal command-line options.

```
storage.journal.enabled
```

```
--journal
```

```
--nojournal
```

```
storage: dbPath: <string> journal: commitIntervalMs: <num> directoryPerDB: <boolean> syncPeriodSecs: <int> engine: <string> wiredTiger: engineConfig: cacheSizeGB: <number> journalCompressor: <string> directoryForIndexes: <boolean> maxCacheOverflowFileSizeGB: <number> collectionConfig: blockCompressor: <string> indexConfig: prefixCompression: <boolean> inMemory: engineConfig: inMemorySizeGB: <number> oplogMinRetentionHours: <double>
```

```
storage: dbPath: <string> journal: commitIntervalMs: <num> directoryPerDB: <boolean> syncPeriodSecs: <int> engine: <string> wiredTiger: engineConfig: cacheSizeGB: <number> journalCompressor: <string> directoryForIndexes: <boolean> maxCacheOverflowFileSizeGB: <number> collectionConfig: blockCompressor: <string> indexConfig: prefixCompression: <boolean> inMemory: engineConfig: inMemorySizeGB: <number> oplogMinRetentionHours: <double>
```

```
storage.dbPath
```

Type: string
Default:
- /data/db on Linux and macOS
- \data\db on Windows
/data/db on Linux and macOS

```
/data/db
```

\data\db on Windows

```
\data\db
```

The directory where the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance stores its data.

```
mongod
```

The [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
storage.dbPath
```

```
mongod
```

The default mongod.conf configuration file included with package manager installations uses the following platform-specific default values for storage.dbPath:

```
mongod.conf
```

```
storage.dbPath
```

```
storage.dbPath
```

RHEL / CentOS and Amazon
yum

```
yum
```

/var/lib/mongo

```
/var/lib/mongo
```

SUSE
zypper

```
zypper
```

/var/lib/mongo

```
/var/lib/mongo
```

Ubuntu and Debian
apt

```
apt
```

/var/lib/mongodb

```
/var/lib/mongodb
```

macOS
brew

```
brew
```

/usr/local/var/mongodb

```
/usr/local/var/mongodb
```

The Linux package init scripts do not expect [[storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) to change from the defaults. If you use the Linux packages and change storage.dbPath, you must use your own init scripts and disable the built-in scripts.

```
storage.dbPath
```

```
storage.dbPath
```

```
storage.journal.commitIntervalMs
```

Type: number
Default: 100
The maximum amount of time in milliseconds that the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) process allows between journal operations. Values can range from 1 to 500 milliseconds. Lower values increase the durability of the journal, at the expense of disk performance.

```
mongod
```

On WiredTiger, the default journal commit interval is 100 milliseconds. Additionally, a write that includes or implies j:true causes an immediate sync of the journal. For details or additional conditions that affect the frequency of the sync, see [Journaling Process.](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journal-process)

```
j:true
```

The [storage.journal.commitIntervalMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.journal.commitIntervalMs) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
storage.journal.commitIntervalMs
```

```
mongod
```

Not available for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances that use the [in-memory storage engine.](https://www.mongodb.com/docs/manual/core/inmemory/#std-label-storage-inmemory)

```
mongod
```

```
storage.directoryPerDB
```

Type: boolean
Default: false
When true, MongoDB uses a separate directory to store data for each database. The directories are under the [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) directory, and each subdirectory name corresponds to the database name.

```
true
```

```
storage.dbPath
```

The [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
storage.directoryPerDB
```

```
mongod
```

Not available for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances that use the [in-memory storage engine.](https://www.mongodb.com/docs/manual/core/inmemory/#std-label-storage-inmemory)

```
mongod
```

Starting in MongoDB 5.0, dropping the final collection in a database (or dropping the database itself) when [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) is enabled deletes the newly empty subdirectory for that database.

```
storage.directoryPerDB
```

To change the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) option for existing deployments:

```
storage.directoryPerDB
```

- For standalone instances:Use [[[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)ump](https://www.mongodb.com/docs/database-tools/mongodump/#mongodb-binary-bin.mongodump) on the existing

mongod instance to generate a backup.Stop the mongod instance.Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and
configure a new data directoryRestart the mongod instance.Use [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/#mongodb-binary-bin.mongorestore) to populate the new data
directory.
- Use [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)ump](https://www.mongodb.com/docs/database-tools/mongodump/#mongodb-binary-bin.mongodump) on the existing
mongod instance to generate a backup.
- Stop the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.
- Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and
configure a new data directory
- Restart the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.
- Use [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/#mongodb-binary-bin.mongorestore) to populate the new data
directory.
- For replica sets:Stop a secondary member.Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and
configure a new data directory to that secondary member.Restart that secondary.Use [initial sync](https://www.mongodb.com/docs/manual/core/replica-set-sync/#std-label-replica-set-initial-sync) to populate
the new data directory.Update remaining secondaries in the same fashion.Step down the primary, and update the stepped-down member in the
same fashion.
- Stop a secondary member.
- Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and
configure a new data directory to that secondary member.
- Restart that secondary.
- Use [initial sync](https://www.mongodb.com/docs/manual/core/replica-set-sync/#std-label-replica-set-initial-sync) to populate
the new data directory.
- Update remaining secondaries in the same fashion.
- Step down the primary, and update the stepped-down member in the
same fashion.
For standalone instances:
1. Use [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)ump](https://www.mongodb.com/docs/database-tools/mongodump/#mongodb-binary-bin.mongodump) on the existing
mongod instance to generate a backup.
2. Stop the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.
3. Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and
configure a new data directory
4. Restart the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.
5. Use [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/#mongodb-binary-bin.mongorestore) to populate the new data
directory.
Use [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)ump](https://www.mongodb.com/docs/database-tools/mongodump/#mongodb-binary-bin.mongodump) on the existing mongod instance to generate a backup.

```
mongodump
```

```
mongod
```

Stop the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.

```
mongod
```

Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and configure a new data directory

```
storage.directoryPerDB
```

Restart the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.

```
mongod
```

Use [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/#mongodb-binary-bin.mongorestore) to populate the new data directory.

```
mongorestore
```

For replica sets:
1. Stop a secondary member.
2. Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and
configure a new data directory to that secondary member.
3. Restart that secondary.

4. Use [initial sync](https://www.mongodb.com/docs/manual/core/replica-set-sync/#std-label-replica-set-initial-sync) to populate
the new data directory.
5. Update remaining secondaries in the same fashion.
6. Step down the primary, and update the stepped-down member in the
same fashion.
Stop a secondary member.
Add the [storage.directoryPerDB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.directoryPerDB) value and configure a new data directory to that secondary member.

```
storage.directoryPerDB
```

Restart that secondary.
Use [initial sync](https://www.mongodb.com/docs/manual/core/replica-set-sync/#std-label-replica-set-initial-sync) to populate the new data directory.
Update remaining secondaries in the same fashion.
Step down the primary, and update the stepped-down member in the same fashion.

```
storage.syncPeriodSecs
```

Type: number
Default: 60
The amount of time that can pass before MongoDB flushes data to the data files.
Do not set this value on production systems. In almost every situation, you should use the default setting.
The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) process writes data very quickly to the journal and lazily to the data files. [[storage.syncPeriodSecs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.syncPeriodSecs)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.syncPeriodSecs) has no effect on [Journaling](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journaling-internals), but if storage.syncPeriodSecs is set to 0 the journal eventually consumes all available disk space.

```
mongod
```

```
storage.syncPeriodSecs
```

```
storage.syncPeriodSecs
```

```

```

The [storage.syncPeriodSecs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.syncPeriodSecs) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
storage.syncPeriodSecs
```

```
mongod
```

Not available for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances that use the [in-memory storage engine.](https://www.mongodb.com/docs/manual/core/inmemory/#std-label-storage-inmemory)

```
mongod
```

To provide [durable](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-durable) data, [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) uses [checkpoints](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger-checkpoints). For more details, see [Journaling and the WiredTiger Storage Engine.](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journaling-wiredTiger)

```
storage.engine
```

Default: wiredTiger

```
wiredTiger
```

The storage engine for the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) database. Available values include:

```
mongod
```

wiredTiger

```
wiredTiger
```

To specify the [WiredTiger Storage Engine.](https://www.mongodb.com/docs/manual/core/wiredtiger/)
inMemory

```
inMemory
```

To specify the [In-Memory Storage Engine for Self-Managed Deployments.](https://www.mongodb.com/docs/manual/core/inmemory/)
Available in MongoDB Enterprise only.
If you attempt to start a [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) with a [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) that contains data files produced by a storage engine other than the one specified by [storage.engine](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.engine), mongod refuses to start.

```
mongod
```

```
storage.dbPath
```

```
storage.engine
```

```
mongod
```

```
storage.oplogMinRetentionHours
```

Type: double
Specifies the minimum number of hours to preserve an oplog entry, where the decimal values represent the fractions of an hour. For example, a value of 1.5 represents one hour and thirty minutes.

```
1.5
```

The value must be greater than or equal to 0. A value of 0 indicates that the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) should truncate the oplog starting with the oldest entries to maintain the configured maximum oplog size.

```

```

```

```

```
mongod
```

Defaults to 0.

```

```

A [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) started with oplogMinRetentionHours only removes an oplog entry if:

```
mongod
```

```
oplogMinRetentionHours
```

- The oplog has reached the maximum configured oplog size and
- The oplog entry is older than the configured number of hours based
on the host system clock.
The oplog has reached the maximum configured oplog size and
The oplog entry is older than the configured number of hours based on the host system clock.
The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) has the following behavior when configured with a minimum oplog retention period:

```
mongod
```

- The oplog can grow without constraint so as to retain oplog entries
for the configured number of hours. This may result in reduction or
exhaustion of system disk space due to a combination of high write
volume and large retention period.
- If the oplog grows beyond its maximum size, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)
may continue to hold that disk space even if the oplog returns to its
maximum size or is configured for a smaller maximum size. See
- Reducing Oplog Size Does Not Immediately Return Disk Space.
- The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) compares the system wall clock to an
oplog entry creation [wall clock time](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-wall-clock-time) when enforcing oplog entry
retention. Clock drift between cluster components may result in
unexpected oplog retention behavior. See
[Clock Synchronization](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-notes-clock-synchronization) for more information on
clock synchronization across cluster members.
The oplog can grow without constraint so as to retain oplog entries for the configured number of hours. This may result in reduction or exhaustion of system disk space due to a combination of high write volume and large retention period.
If the oplog grows beyond its maximum size, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) may continue to hold that disk space even if the oplog returns to its maximum size or is configured for a smaller maximum size. See [Reducing Oplog Size Does Not Immediately Return Disk Space.](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#std-label-replSetResizeOplog-cmd-compact)

```
mongod
```

The [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) compares the system wall clock to an oplog entry creation [wall clock time](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-wall-clock-time) when enforcing oplog entry retention. Clock drift between cluster components may result in unexpected oplog retention behavior. See [Clock Synchronization](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-notes-clock-synchronization) for more information on clock synchronization across cluster members.

```
mongod
```

To change the minimum oplog retention period after starting the [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod), use [[[replSetResizeOplog](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#mongodb-dbcommand-dbcmd.replSetResizeOplog)](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#mongodb-dbcommand-dbcmd.replSetResizeOplog)](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#mongodb-dbcommand-dbcmd.replSetResizeOplog). replSetResizeOplog enables you to resize the oplog dynamically without restarting the mongod process. To persist the changes made using replSetResizeOplog through a restart, update the value of [oplogMinRetentionHours.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.oplogMinRetentionHours)

```
mongod
```

```
replSetResizeOplog
```

```
replSetResizeOplog
```

```
mongod
```

```
replSetResizeOplog
```

```
oplogMinRetentionHours
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#storage.wiredtiger-optionsstorage.wiredTiger Options

```
storage.wiredTiger
```

```
storage: wiredTiger: engineConfig: cacheSizeGB: <number> cacheSizePct: <number> journalCompressor: <string> directoryForIndexes: <boolean> maxCacheOverflowFileSizeGB: <number> collectionConfig: blockCompressor: <string> indexConfig: prefixCompression: <boolean>
```

```
storage: wiredTiger: engineConfig: cacheSizeGB: <number> cacheSizePct: <number> journalCompressor: <string> directoryForIndexes: <boolean> maxCacheOverflowFileSizeGB: <number> collectionConfig: blockCompressor: <string> indexConfig: prefixCompression: <boolean>
```

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

Type: float
Defines the maximum size of the internal cache that WiredTiger uses for all data. The memory that an index build consumes (see [maxIndexBuildMemoryUsageMegabytes](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxIndexBuildMemoryUsageMegabytes)) is separate from the WiredTiger cache memory.

```
maxIndexBuildMemoryUsageMegabytes
```

Avoid increasing the WiredTiger internal cache size above its default value. If your use case requires to do so, you can use [storage.wiredTiger.engineConfig.cacheSizePct](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct) to specify a percentage of up to 80% of available memory. Values can range from 0.256GB to 10000GB.

```
storage.wiredTiger.engineConfig.cacheSizePct
```

##### https://www.mongodb.com/docs/manual/reference/configuration-options/#cache-configuration-settingsCache Configuration Settings
The default WiredTiger internal cache size is the larger of either:
- 50% of (RAM - 1GB), or
- 0.256 GB.
50% of (RAM - 1GB), or
0.256 GB.
For example, on a system with a total of 4GB of RAM the WiredTiger cache uses 1.5GB of RAM (0.5 * (4GB - 1GB) = 1.5 GB). When providing a specific cache size ensure the RAM does not exceed the bounds of 0.256GB to 10000GB.

```
0.5 * (4GB - 1GB) = 1.5 GB
```

Avoid increasing the WiredTiger internal cache size above its default value. If your case requires to do so, you can use --wiredTigerCacheSizePct to account for changes in memory due to vertical. You must specify a percentage of up to 80% of available memory. Calculated values can range from 0.256GB to 10000GB. For example, on a system with 2GB of RAM the --wiredTigerCacheSizePct cannot be set to 10 because 10% of 2GB is 0.2 GB, which is less than 0.256GB.

```
--wiredTigerCacheSizePct
```

```
--wiredTigerCacheSizePct
```

In some instances, such as when running in a container that is configured to use less RAM than the amount of memory provisioned for the host, you must account for the limits. You may need to configure the WiredTiger cache to an appropriate value, as WiredTiger may not account for the memory limits of the specific container in certain cases.
To view the [memory limit](https://www.mongodb.com/docs/manual/reference/command/[hostInfo](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-dbcommand-dbcmd.hostInfo)/#mongodb-data-hostInfo.system.memLimitMB), the value that WiredTiger utilizes as the maximum amount of RAM available use the hostInfo command.

```
memory limit
```

```
hostInfo
```

With WiredTiger, MongoDB utilizes both the WiredTiger internal cache and the filesystem cache.
With the filesystem cache, MongoDB automatically uses all free memory that is not used by the WiredTiger cache or by other processes.

The [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) limits the size of the WiredTiger internal cache. The operating system uses the available free memory for filesystem cache, which allows the compressed MongoDB data files to stay in memory. In addition, the operating system uses any free RAM to buffer file system blocks and file system cache.

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.
The default WiredTiger internal cache size value assumes that there is a single [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance per machine. If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

```
mongod
```

```
mongod
```

If you run [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) in a container (for example, lxc, cgroups, Docker, etc.) that does not have access to all of the RAM available in a system, you must set [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) or [storage.wiredTiger.engineConfig.cacheSizePct](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct) to a value less than the amount of RAM available in the container. The exact amount depends on the other processes running in the container. See [memLimitMB.](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-data-hostInfo.system.memLimitMB)

```
mongod
```

```
lxc
```

```
cgroups
```

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

```
memLimitMB
```

You can only provide one of either [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) or [storage.wiredTiger.engineConfig.cacheSizePct.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct)

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

Type: float
Defines the maximum amount of memory to allocate for cache as a percentage of physical RAM. The memory that an index build consumes (see [maxIndexBuildMemoryUsageMegabytes](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxIndexBuildMemoryUsageMegabytes)) is separate from the WiredTiger cache memory.

```
maxIndexBuildMemoryUsageMegabytes
```

You can specify a percentage of up to 80% of available memory. Values range from 0.25 GB to 10000 GB.

```
0.25
```

```
10000
```

##### https://www.mongodb.com/docs/manual/reference/configuration-options/#cache-configuration-settings-1Cache Configuration Settings
The default WiredTiger internal cache size is the larger of either:
- 50% of (RAM - 1GB), or
- 0.256 GB.
50% of (RAM - 1GB), or
0.256 GB.
For example, on a system with a total of 4GB of RAM the WiredTiger cache uses 1.5GB of RAM (0.5 * (4GB - 1GB) = 1.5 GB). When providing a specific cache size ensure the RAM does not exceed the bounds of 0.256GB to 10000GB.

```
0.5 * (4GB - 1GB) = 1.5 GB
```

Avoid increasing the WiredTiger internal cache size above its default value. If your case requires to do so, you can use --wiredTigerCacheSizePct to account for changes in memory due to vertical. You must specify a percentage of up to 80% of available memory. Calculated values can range from 0.256GB to 10000GB. For example, on a system with 2GB of RAM the --wiredTigerCacheSizePct cannot be set to 10 because 10% of 2GB is 0.2 GB, which is less than 0.256GB.

```
--wiredTigerCacheSizePct
```

```
--wiredTigerCacheSizePct
```

In some instances, such as when running in a container that is configured to use less RAM than the amount of memory provisioned for the host, you must account for the limits. You may need to configure the WiredTiger cache to an appropriate value, as WiredTiger may not account for the memory limits of the specific container in certain cases.
To view the [memory limit](https://www.mongodb.com/docs/manual/reference/command/[hostInfo](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-dbcommand-dbcmd.hostInfo)/#mongodb-data-hostInfo.system.memLimitMB), the value that WiredTiger utilizes as the maximum amount of RAM available use the hostInfo command.

```
memory limit
```

```
hostInfo
```

With WiredTiger, MongoDB utilizes both the WiredTiger internal cache and the filesystem cache.
With the filesystem cache, MongoDB automatically uses all free memory that is not used by the WiredTiger cache or by other processes.

The [storage.wiredTiger.engineConfig.cacheSizePct](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct) limits the size of the WiredTiger internal cache. The operating system uses the available free memory for filesystem cache, which allows the compressed MongoDB data files to stay in memory. In addition, the operating system uses any free RAM to buffer file system blocks and file system cache.

```
storage.wiredTiger.engineConfig.cacheSizePct
```

To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.
The default WiredTiger internal cache size value assumes that there is a single [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance per machine. If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

```
mongod
```

```
mongod
```

If you run [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) in a container (for example, lxc, cgroups, Docker, etc.) that does not have access to all of the RAM available in a system, you must set [storage.wiredTiger.engineConfig.cacheSizePct](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct) or [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) to a value less than the amount of RAM available in the container. The exact amount depends on the other processes running in the container. See [memLimitMB.](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-data-hostInfo.system.memLimitMB)

```
mongod
```

```
lxc
```

```
cgroups
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
memLimitMB
```

You can only provide one of either [storage.wiredTiger.engineConfig.cacheSizePct](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct) or [storage.wiredTiger.engineConfig.cacheSizeGB.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB)

```
storage.wiredTiger.engineConfig.cacheSizePct
```

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
storage.wiredTiger.engineConfig.journalCompressor
```

Default: snappy
Specifies the type of compression to use to compress WiredTiger journal data.
Available compressors are:
- none
- [snappy](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-snappy)
- [zlib](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zlib)
- [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd)
none

```
none
```

- snappy

```
storage.wiredTiger.engineConfig.directoryForIndexes
```

Type: boolean
Default: false
When [storage.wiredTiger.engineConfig.directoryForIndexes](https://www.[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.directoryForIndexes) is true, mongod stores indexes and collections in separate subdirectories under the data (i.e. [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath)) directory. Specifically, mongod stores the indexes in a subdirectory named index and the collection data in a subdirectory named collection.

```
storage.wiredTiger.engineConfig.directoryForIndexes
```

```
true
```

```
mongod
```

```
storage.dbPath
```

```
mongod
```

```
index
```

```
collection
```

By using a symbolic link, you can specify a different location for the indexes. Specifically, when [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance is not running, move the index subdirectory to the destination and create a symbolic link named index under the data directory to the new destination.

```
mongod
```

```
index
```

```
index
```

```
storage.wiredTiger.engineConfig.zstdCompressionLevel
```

Type: integer
Default: 6
New in version 5.0
Changed in version 8.2
Specifies the level of compression applied when using the [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd) compressor.
Values can range from -7 to 22.
Positive values specify the compression level, where a higher value for zstdCompressionLevel results in a higher compression ratio at the cost of slower compression and decompression speeds.

```
zstdCompressionLevel
```

Negative values provide faster compression and decompression speeds at the cost of the compression ratio.
Specifying a value of 0 uses zstd's internal default compression level of 3, which differs from the MongoDB default of 6.

```

```

Only applicable when either [blockCompressor](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.collectionConfig.blockCompressor) or [journalCompressor](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.journalCompressor) (or both) are set to zstd.

```
blockCompressor
```

```
journalCompressor
```

```
zstd
```

When downgrading to an earlier version of MongoDB, ensure that the [storage.wiredTiger.engineConfig.zstdCompressionLevel](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.zstdCompressionLevel) setting is configured to a range supported by that version. For example, MongoDB 8.0 supports a range of 1 to 22.

```
storage.wiredTiger.engineConfig.zstdCompressionLevel
```

```
storage.wiredTiger.collectionConfig.blockCompressor
```

Default: snappy
Specifies the default compression for collection data. You can override this on a per-collection basis when creating collections.
Available compressors are:
- none
- [snappy](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-snappy)
- [zlib](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zlib)
- [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd)
none

```
none
```

- snappy
[[storage.wiredTiger.collectionConfig.blockCompressor](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.collectionConfig.blockCompressor)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.collectionConfig.blockCompressor) affects all collections created. If you change the value of storage.wiredTiger.collectionConfig.blockCompressor on an existing MongoDB deployment, all new collections uses the specified compressor. Existing collections continue to use the compressor specified when they were created, or the default compressor at that time.

```
storage.wiredTiger.collectionConfig.blockCompressor
```

```
storage.wiredTiger.collectionConfig.blockCompressor
```

```
storage.wiredTiger.indexConfig.prefixCompression
```

Default: true
Enables or disables [prefix compression](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-prefix-compression) for index data.
Specify true for [storage.wiredTiger.indexConfig.prefixCompression](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.indexConfig.prefixCompression) to enable [prefix compression](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-prefix-compression) for index data, or false to disable prefix compression for index data.

```
true
```

```
storage.wiredTiger.indexConfig.prefixCompression
```

```
false
```

The [[storage.wiredTiger.indexConfig.prefixCompression](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.indexConfig.prefixCompression)](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.indexConfig.prefixCompression) setting affects all indexes created. If you change the value of storage.wiredTiger.indexConfig.prefixCompression on an existing MongoDB deployment, all new indexes uses prefix compression. Existing indexes are not affected.

```
storage.wiredTiger.indexConfig.prefixCompression
```

```
storage.wiredTiger.indexConfig.prefixCompression
```

#### https://www.mongodb.com/docs/manual/reference/configuration-options/#storage.inmemory-optionsstorage.inmemory Options

```
storage.inmemory
```

```
storage: inMemory: engineConfig: inMemorySizeGB: <number>
```

```
storage: inMemory: engineConfig: inMemorySizeGB: <number>
```

```
storage.inMemory.engineConfig.inMemorySizeGB
```

Type: float
Default: 50% of physical RAM less 1 GB
Values can range from 256MB to 10TB and can be a float.
Maximum amount of memory to allocate for [in-memory storage engine](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/inmemory/) data, including indexes, oplog if the mongod is part of replica set, replica set or sharded cluster metadata, etc.

```
mongod
```

By default, the in-memory storage engine uses 50% of physical RAM minus 1 GB.

### Enterprise Feature
Available in MongoDB Enterprise only.

### https://www.mongodb.com/docs/manual/reference/configuration-options/#operationprofiling-optionsoperationProfiling Options
```
operationProfiling
```

```
operationProfiling: mode: <string> slowOpThresholdMs: <int> slowOpSampleRate: <double> filter: <string>
```

```
operationProfiling: mode: <string> slowOpThresholdMs: <int> slowOpSampleRate: <double> filter: <string>
```

```
operationProfiling.mode
```

Type: string
Default: off

```
off
```

Specifies which operations should be [profiled](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/). The following profiler levels are available:
off

```
off
```

The profiler is off and does not collect any data. This is the default profiler level. This level corresponds to profiler [level 0.](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-level)
slowOp

```
slowOp
```

The profiler collects data for operations that take longer than the value of slowms. This level corresponds to profiler [level 1.](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-level)

```
slowms
```

all

```
all
```

The profiler collects data for all operations. This level corresponds to profiler [level 2.](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-level)

Profiling can degrade performance and expose unencrypted query data in the system log. Carefully consider any performance and security implications before configuring and enabling the profiler on a production deployment.
See [Profiler Overhead](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/#std-label-database-profiling-overhead) for more information on potential performance degradation.

```
operationProfiling.slowOpThresholdMs
```

Type: integer
Default: 100
The slow operation time threshold, in milliseconds. Operations that run for longer than this threshold are considered slow.
Slow operations are logged based on workingMillis, which is the amount of time that MongoDB spends working on that operation. This means that factors such as waiting for locks and flow control do not affect whether an operation exceeds the slow operation threshold.

```
workingMillis
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

This setting is available for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

```
mongod
```

```
mongos
```

- For [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances, the setting affects both
the diagnostic log and, if enabled, the profiler.
- For [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances, the setting affects the
diagnostic log only and not the profiler, since profiling is not
available on [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)
For [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances, the setting affects both the diagnostic log and, if enabled, the profiler.

```
mongod
```

For [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances, the setting affects the diagnostic log only and not the profiler, since profiling is not available on [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

```
mongos
```

```
mongos
```

```
operationProfiling.slowOpSampleRate
```

Type: double
Default: 1.0
The fraction of slow operations that should be profiled or logged. [operationProfiling.slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate) accepts values between 0 and 1, inclusive.

```
operationProfiling.slowOpSampleRate
```

The [slowOpSampleRate](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate) setting is available for mongod and [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

```
slowOpSampleRate
```

```
mongod
```

```
mongos
```

- For [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances, the setting affects both
the diagnostic log and, if enabled, the profiler.
- For [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances, the setting affects the
diagnostic log only and not the profiler since profiling is not
available on [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

For [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances, the setting affects both the diagnostic log and, if enabled, the profiler.

```
mongod
```

For [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances, the setting affects the diagnostic log only and not the profiler since profiling is not available on [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

```
mongos
```

```
mongos
```

```
operationProfiling.filter
```

Type: string representation of a query document
A filter expression that controls which operations are profiled and logged.
When filter is set, [slowOpThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpThresholdMs) and [slowOpSampleRate](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-operationProfiling.slowOpSampleRate) are not used for profiling and slow-query log lines.

```
filter
```

```
slowOpThresholdMs
```

```
slowOpSampleRate
```

When you set a profile filter in the configuration file, the filter applies to all databases in the deployment. To set a profile filter for a specific database, use the [db.setProfilingLevel()](https://www.mongodb.com/docs/manual/reference/method/db.setProfilingLevel/#mongodb-method-db.setProfilingLevel) method.

```
db.setProfilingLevel()
```

The option takes a string representation of a query document of the form:

```
{ <field1>: <expression1>, ... }
```

```
{ <field1>: <expression1>, ... }
```

The <field> can be [any field in the profiler output](https://www.mongodb.com/docs/manual/reference/database-profiler/#std-label-profiler). The <expression> is a [query condition expression.](https://www.mongodb.com/docs/manual/reference/mql/query-predicates/#std-label-query-selectors)

```
<field>
```

```
<expression>
```

To specify a profiling filter in a [configuration file](https://www.mongodb.com/docs/manual/reference/configuration-options/), you must:
- Enclose the filter document in single quotes to pass the document
as a string.
- Use the YAML format of the configuration file.
Enclose the filter document in single quotes to pass the document as a string.
Use the YAML format of the configuration file.
For example, the following filter configures the profiler to log query operations that take longer than 2 seconds:

```
filter
```

```
query
```

```
operationProfiling: mode: all filter: '{ op: "query", millis: { $gt: 2000 } }'
```

```
operationProfiling: mode: all filter: '{ op: "query", millis: { $gt: 2000 } }'
```

```
replication
```

```
replication: oplogSizeMB: <int> replSetName: <string> enableMajorityReadConcern: <boolean>
```

```
replication: oplogSizeMB: <int> replSetName: <string> enableMajorityReadConcern: <boolean>
```

```
replication.oplogSizeMB
```

Type: integer
The maximum size in megabytes for the [oplog](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-oplog). The oplogSizeMB setting configures the uncompressed size of the oplog, not the size on disk.

```
oplogSizeMB
```

The oplog can grow past its configured size limit to avoid deleting the [majority commit point.](https://www.mongodb.com/docs/manual/reference/command/replSetGetStatus/#mongodb-data-replSetGetStatus.optimes.lastCommittedOpTime)

```
majority commit point
```

By default, the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) process creates an oplog based on the maximum amount of space available. For 64-bit systems, the oplog is typically 5% of available disk space.

```
mongod
```

Once the [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) has created the oplog for the first time, changing the [replication.oplogSizeMB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.oplogSizeMB) option does not affect the size of the oplog. To change the maximum oplog size after starting the mongod, use [[[replSetResizeOplog](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#mongodb-dbcommand-dbcmd.replSetResizeOplog)](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#mongodb-dbcommand-dbcmd.replSetResizeOplog)](https://www.mongodb.com/docs/manual/reference/command/replSetResizeOplog/#mongodb-dbcommand-dbcmd.replSetResizeOplog). replSetResizeOplog enables you to resize the oplog dynamically without restarting the mongod process. To persist the changes made using replSetResizeOplog through a restart, update the value of [oplogSizeMB.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.oplogSizeMB)

```
mongod
```

```
replication.oplogSizeMB
```

```
mongod
```

```
replSetResizeOplog
```

```
replSetResizeOplog
```

```
mongod
```

```
replSetResizeOplog
```

```
oplogSizeMB
```

See [Oplog Size](https://www.mongodb.com/docs/manual/core/replica-set-oplog/#std-label-replica-set-oplog-sizing) for more information.
The [replication.oplogSizeMB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.oplogSizeMB) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
replication.oplogSizeMB
```

```
mongod
```

```
replication.replSetName
```

Type: string
The name of the replica set that the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) is part of. All hosts in the replica set must have the same set name.

```
mongod
```

If your application connects to more than one replica set, each set must have a distinct name. Some drivers group replica set connections by replica set name.
The [replication.replSetName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.replSetName) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
replication.replSetName
```

```
mongod
```

[replication.replSetName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.replSetName) cannot be used in conjunction with storage.indexBuildRetry.

```
replication.replSetName
```

```
storage.indexBuildRetry
```

```
replication.enableMajorityReadConcern
```

Default: true
Configures support for ["majority"](https://www.mongodb.com/docs/manual/reference/read-concern-majority/#mongodb-readconcern-readconcern.-majority-) read concern.

```
"majority"
```

Starting in MongoDB 5.0, [enableMajorityReadConcern](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.enableMajorityReadConcern) cannot be changed and is always set to true. Attempting to start a storage engine that does not support majority read concern with the --enableMajorityReadConcern option fails and return an error message.

```
enableMajorityReadConcern
```

```
true
```

```
--enableMajorityReadConcern
```

In earlier versions of MongoDB, [enableMajorityReadConcern](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.enableMajorityReadConcern) was configurable.

```
enableMajorityReadConcern
```

If you are using a three-member primary-secondary-arbiter (PSA) architecture, consider the following:
- The write concern ["majority"](https://www.mongodb.com/docs/manual/reference/write-concern/#mongodb-writeconcern-writeconcern.-majority-) can cause
performance issues if a secondary is unavailable or lagging. For
advice on how to mitigate these issues, see
- If you are using a global default ["majority"](https://www.mongodb.com/docs/manual/reference/read-concern-majority/#mongodb-readconcern-readconcern.-majority-)
and the write concern is less than the size of the majority,
your queries may return stale (not fully replicated) data.
The write concern ["majority"](https://www.mongodb.com/docs/manual/reference/write-concern/#mongodb-writeconcern-writeconcern.-majority-) can cause performance issues if a secondary is unavailable or lagging. For advice on how to mitigate these issues, see [Mitigate Performance Issues with a Self-Managed PSA Replica Set.](https://www.mongodb.com/docs/manual/tutorial/mitigate-psa-performance-issues/#std-label-performance-issues-psa)

```
"majority"
```

If you are using a global default ["majority"](https://www.mongodb.com/docs/manual/reference/read-concern-majority/#mongodb-readconcern-readconcern.-majority-) and the write concern is less than the size of the majority, your queries may return stale (not fully replicated) data.

```
"majority"
```

```
sharding
```

```
sharding: clusterRole: <string>
```

```
sharding: clusterRole: <string>
```

```
sharding.clusterRole
```

Type: string
The role that the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance has in the sharded cluster. Set this setting to one of the following:

```
mongod
```

configsvr

```
configsvr
```

Start this instance as a [config server](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-config-server). The instance starts on port 27019 by default.

```
27019
```

When you configure a MongoDB instance as clusterRole configsvr you must also specify a [replSetName.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.replSetName)

```
configsvr
```

```
replSetName
```

shardsvr

```
shardsvr
```

Start this instance as a [shard](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-shard). The instance starts on port 27018 by default.

```
27018
```

When you configure a MongoDB instance as a a clusterRole shardsvr you must also specify a [replSetName.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.replSetName)

```
shardsvr
```

```
replSetName
```

Setting sharding.clusterRole requires the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance to be running with replication. To deploy the instance as a replica set member, use the [replSetName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.replSetName) setting and specify the name of the replica set.

```
sharding.clusterRole
```

```
mongod
```

```
replSetName
```

The [sharding.clusterRole](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-sharding.clusterRole) setting is available only for [mongod.](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)

```
sharding.clusterRole
```

```
mongod
```

```
sharding.archiveMovedChunks
```

Type: boolean
Default: false.
During chunk migration, a shard does not save documents migrated from the shard.

```
auditLog
```

## Note

```
auditLog: destination: <string> format: <string> path: <string> filter: <string> schema: <string>
```

```
auditLog: destination: <string> format: <string> path: <string> filter: <string> schema: <string>
```

```
auditLog.auditEncryptionKeyIdentifier
```

Type: string
New in version 6.0.
Specifies the unique identifier of the Key Management Interoperability Protocol (KMIP) key for [audit log encryption.](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/#std-label-security-encryption-at-rest-audit-log)
You cannot use [auditLog.auditEncryptionKeyIdentifier](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.auditEncryptionKeyIdentifier) and [auditLog.localAuditKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.localAuditKeyFile) together.

```
auditLog.auditEncryptionKeyIdentifier
```

```
auditLog.localAuditKeyFile
```

## Note

```
auditLog.compressionMode
```

Type: string
New in version 5.3.
Specifies the compression mode for [audit log encryption](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/#std-label-security-encryption-at-rest-audit-log). You must also enable audit log encryption using either [auditLog.auditEncryptionKeyIdentifier](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.auditEncryptionKeyIdentifier) or [auditLog.localAuditKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.localAuditKeyFile).

```
auditLog.auditEncryptionKeyIdentifier
```

```
auditLog.localAuditKeyFile
```

[auditLog.compressionMode](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.compressionMode) can be set to one of these values:

```
auditLog.compressionMode
```

zstd

```
zstd
```

Use the [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd) algorithm to compress the audit log.
none (default)

```
none
```

Do not compress the audit log.

## Note

```
auditLog.destination
```

Type: string
When set, [auditLog.destination](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.destination) enables [auditing](https://www.mongodb.com/docs/manual/core/auditing/#std-label-auditing) and specifies where [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod sends all audit events.

```
auditLog.destination
```

```
mongos
```

```
mongod
```

[auditLog.destination](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.destination) can have one of the following values:

```
auditLog.destination
```

syslog

```
syslog
```

Output the audit events to syslog in JSON format. Not available on Windows. Audit messages have a syslog severity level of info and a facility level of user.

```
info
```

```
user
```

The syslog message limit can result in the truncation of audit messages. The auditing system neither detects the truncation nor errors upon its occurrence.
console

```
console
```

Output the audit events to stdout in JSON format.

```
stdout
```

file

```
file
```

Output the audit events to the file specified in [auditLog.path](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.path) in the format specified in [auditLog.format.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.format)

```
auditLog.path
```

```
auditLog.format
```

## Note

```
auditLog.filter
```

Type: string representation of a document
The filter to limit the [types of operations](https://www.mongodb.com/docs/manual/reference/audit-message/mongo/#std-label-audit-action-details-results) the [audit system](https://www.mongodb.com/docs/manual/core/auditing/) records. The option takes a string representation of a query document of the form:

```
{ <field1>: <expression1>, ... }
```

```
{ <field1>: <expression1>, ... }
```

The <field> can be [any field in the audit message](https://www.mongodb.com/docs/manual/reference/audit-message/), including fields returned in the [param](https://www.mongodb.com/docs/manual/reference/audit-message/mongo/#std-label-audit-action-details-results) document. The <expression> is a [query condition expression.](https://www.mongodb.com/docs/manual/reference/mql/query-predicates/#std-label-query-selectors)

```
<field>
```

```
<expression>
```

To specify an audit filter, enclose the filter document in single quotes to pass the document as a string.
To specify the audit filter in a [configuration file](https://www.mongodb.com/docs/manual/reference/configuration-options/#std-label-configuration-options), you must use the YAML format of the configuration file.

## Note

```
auditLog.format
```

Type: string
The format of the output file for [auditing](https://www.mongodb.com/docs/manual/core/auditing/) if [destination](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.destination) is file. The [auditLog.format](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.format) option can have one of the following values:

```
destination
```

```
file
```

```
auditLog.format
```

JSON

```
JSON
```

Output the audit events in JSON format to the file specified in [auditLog.path.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.path)

```
auditLog.path
```

BSON

```
BSON
```

Output the audit events in BSON binary format to the file specified in [auditLog.path.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.path)

```
auditLog.path
```

Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.

## Note

```
auditLog.localAuditKeyFile
```

Type: string
New in version 5.3.
Specifies the path and file name for a local audit key file for [audit log encryption.](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/#std-label-security-encryption-at-rest-audit-log)

## Note
Only use [auditLog.localAuditKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.localAuditKeyFile) for testing because the key is not secured. To secure the key, use [auditLog.auditEncryptionKeyIdentifier](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.auditEncryptionKeyIdentifier) and an external Key Management Interoperability Protocol (KMIP) server.

```
auditLog.localAuditKeyFile
```

```
auditLog.auditEncryptionKeyIdentifier
```

You cannot use [auditLog.localAuditKeyFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.localAuditKeyFile) and [auditLog.auditEncryptionKeyIdentifier](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.auditEncryptionKeyIdentifier) together.

```
auditLog.localAuditKeyFile
```

```
auditLog.auditEncryptionKeyIdentifier
```

```
auditLog.path
```

Type: string
The output file for [auditing](https://www.mongodb.com/docs/manual/core/auditing/#std-label-auditing) if [destination](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.destination) has value of file. The [auditLog.path](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-auditLog.path) option can take either a full path name or a relative path name.

```
destination
```

```
file
```

```
auditLog.path
```

```
auditLog.runtimeConfiguration
```

Type: boolean
Specifies if a node allows runtime configuration of audit filters and the auditAuthorizationSuccess variable. If true the node can take part in Online Audit Filter Management.

```
true
```

```
auditLog.schema
```

Type: string
Default: mongo

```
mongo
```

New in version 8.0.
Specifies the format used for audit logs. You can specify one of the following values for auditLog.schema:

```
auditLog.schema
```

mongo

```
mongo
```

Logs are written in a format designed by MongoDB.
For example log messages, see [mongo Schema Audit Messages.](https://www.mongodb.com/docs/manual/reference/audit-message/mongo/#std-label-event-audit-messages-mongo)
OCSF

```
OCSF
```

Logs are written in OCSF format. This option provides logs in a standardized format compatible with log processors.
For example log messages, see [OCSF Schema Audit Messages.](https://www.mongodb.com/docs/manual/reference/audit-message/ocsf/#std-label-event-audit-messages-ocsf)

```
mongot
```

Use the following options to configure mongot with mongod in Public Preview.

```
mongot
```

```
mongod
```

```
syncSource: replicaSet: <object> hostAndPort: <string> username: <string> passwordFile: <string> authSource: <string> tls: <boolean> x509: tlsCertificateKeyFile: <string> tlsCertificateKeyFilePasswordFile: <string> readPreference: <string> router: <object> hostAndPort: <string> username: <string> passwordFile: <string> tls: <boolean> x509: tlsCertificateKeyFile: <string> tlsCertificateKeyFilePasswordFile: <string> caFile: <string>storage: dataPath: <string>server: grpc: address: <string> tls: mode: <string> certificateKeyFile: <string> caFile: <string> name: <string>metrics: enabled: <boolean> address: <boolean>ftdc: enabled: <boolean> directorySizeMb: <integer> fileSizeMb: <integer> collectionPeriodMillis: <integer>healthCheck: address: <string>logging: verbosity: <string> logPath: <string>
```

```
syncSource: replicaSet: <object> hostAndPort: <string> username: <string> passwordFile: <string> authSource: <string> tls: <boolean> x509: tlsCertificateKeyFile: <string> tlsCertificateKeyFilePasswordFile: <string> readPreference: <string> router: <object> hostAndPort: <string> username: <string> passwordFile: <string> tls: <boolean> x509: tlsCertificateKeyFile: <string> tlsCertificateKeyFilePasswordFile: <string> caFile: <string>storage: dataPath: <string>server: grpc: address: <string> tls: mode: <string> certificateKeyFile: <string> caFile: <string> name: <string>metrics: enabled: <boolean> address: <boolean>ftdc: enabled: <boolean> directorySizeMb: <integer> fileSizeMb: <integer> collectionPeriodMillis: <integer>healthCheck: address: <string>logging: verbosity: <string> logPath: <string>
```

```
syncSource.replicaSet
```

Type: Object
Necessity: Required
Replication connections to mongod for mongot.

```
mongod
```

```
mongot
```

```
syncSource.replicaSet.hostAndPort
```

Type: String or Array of Strings
Necessity: Required
One or more host and port specifiers to use to construct the seed list in mongod connection string. Regardless of the number of host and port specifiers, the connection string is in the replica set mode, not the standalone mode.

```
mongod
```

```
syncSource.replicaSet.username
```

Type: String
Necessity: Conditional
Username to use to authenticate mongot with mongod. The specified user must have the [searchCoordinator](https://www.mongodb.com/docs/manual/reference/built-in-roles/#mongodb-authrole-searchCoordinator) role. If you don't configure [syncSource.replicaSet.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.x509), this option is required.

```
mongot
```

```
mongod
```

```
searchCoordinator
```

```
syncSource.replicaSet.x509
```

```
syncSource.replicaSet.passwordFile
```

Type: String
Necessity: Conditional
Path to the file that contains the password that mongot must use to authenticate with mongod. If you don't configure [syncSource.replicaSet.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.x509), this setting is required.

```
mongot
```

```
mongod
```

```
syncSource.replicaSet.x509
```

```
syncSource.replicaSet.authSource
```

Type: String
Necessity: Optional
Name of the database associated with the mongot authentication credentials. If unspecified, authSource defaults to admin.

```
mongot
```

```
authSource
```

```
admin
```

```
syncSource.replicaSet.tls
```

Type: Boolean
Necessity: Optional
Default: false
Direct passthrough to the [TLS](https://www.mongodb.com/docs/manual/reference/connection-string-options/#std-label-uri-options-tls) connection string option. If omitted, defaults to false. If you configure [syncSource.replicaSet.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.x509), this setting must be true

```
false
```

```
syncSource.replicaSet.x509
```

```
true
```

```
syncSource.replicaSet.x509
```

Type: Object
Necessity: Conditional

X.509 certificate settings for authenticating mongot with mongod. If you do not set [syncSource.replicaSet.username](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.username) and [syncSource.replicaSet.passwordFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.passwordFile), this setting is required.

```
mongot
```

```
mongod
```

```
syncSource.replicaSet.username
```

```
syncSource.replicaSet.passwordFile
```

```
syncSource.replicaSet.x509.tlsCertificateKeyFile
```

Type: String
Necessity: Required
Path to the PEM file that contains the x.509 certificate and private key for authenticating mongot with mongod.

```
mongot
```

```
mongod
```

```
syncSource.replicaSet.x509.tlsCertificateKeyFilePasswordFile
```

Type: String
Necessity: Optional
Path to the file that contains the password to decrypt the certificate key file specified in [syncSource.replicaSet.x509.tlsCertificateKeyFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.x509.tlsCertificateKeyFile)

```
syncSource.replicaSet.x509.tlsCertificateKeyFile
```

```
syncSource.replicaSet.readPreference
```

Type: String
Necessity: Optional
Default: secondaryPreferred
Direct passthrough to the [readPreference](https://www.mongodb.com/docs/manual/core/read-preference/#std-label-read-preference) connection string option. If omitted, defaults to secondaryPreferred for replica set.

```
secondaryPreferred
```

```
syncSource.router
```

Type: Object
Necessity: Conditional
Replication connections to mongos for mongot. If omitted, mongot assumes that it is running in a non-sharded environment. If mongot is running in a sharded environment and you don't define this setting, the resulting behavior will be undefined. Therefore, this is required for sharded clusters.

```
mongos
```

```
mongot
```

```
mongot
```

```
mongot
```

```
syncSource.router.hostAndPort
```

Type: String or Array of Strings
Necessity: Required
One or more host and port specifiers to use to construct the seed list in mongos connection string. Regardless of the number of host and port specifiers, the connection string is in the replica set mode, not the standalone mode.

```
mongos
```

```
syncSource.router.username
```

Type: String
Necessity: Conditional
Username to use to authenticate mongot with mongos. The specified user must have the [searchCoordinator](https://www.mongodb.com/docs/manual/reference/built-in-roles/#mongodb-authrole-searchCoordinator) role. If you don't configure [syncSource.router.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.x509), this setting is required.

```
mongot
```

```
mongos
```

```
searchCoordinator
```

```
syncSource.router.x509
```

```
syncSource.router.passwordFile
```

Type: String
Necessity: Conditional
Path to the file that contains the password that mongot must use to authenticate with mongos. If you don't configure [syncSource.router.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.x509), this setting is required.

```
mongot
```

```
mongos
```

```
syncSource.router.x509
```

```
syncSource.router.tls
```

Type: Boolean
Necessity: Optional
Default: false
Direct passthrough to the [TLS](https://www.mongodb.com/docs/manual/reference/connection-string-options/#std-label-uri-options-tls) connection string option. If omitted, defaults to false. If you configure [syncSource.router.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.x509), this setting must be true.

```
false
```

```
syncSource.router.x509
```

```
true
```

```
syncSource.router.x509
```

Type: Object
Necessity: Conditional
X.509 certificate settings for authenticating mongot with mongos. if you do not set [syncSource.router.username](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.username) and [syncSource.router.passwordFile](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.passwordFile), this setting is required .

```
mongot
```

```
mongos
```

```
syncSource.router.username
```

```
syncSource.router.passwordFile
```

```
syncSource.router.x509.tlsCertificateKeyFile
```

Type: String

## https://www.mongodb.com/docs/manual/reference/configuration-options/#mongotoptionsmongot Options
Necessity: Required
Path to the PEM file that contains the x.509 certificate and private key for authenticating mongot with mongos.

```
mongot
```

```
mongos
```

```
syncSource.router.x509.tlsCertificateKeyFilePasswordFile
```

Type: String
Necessity: Optional
Path to the file that contains the password to decrypt the certificate key file specified in [syncSource.router.x509.tlsCertificateKeyFile.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.x509.tlsCertificateKeyFile)

```
syncSource.router.x509.tlsCertificateKeyFile
```

```
syncSource.router.readPreference
```

Type: String
Necessity: Optional
Direct passthrough to the [readPreference](https://www.mongodb.com/docs/manual/core/read-preference/#std-label-read-preference) connection string option.

```
syncSource.caFile
```

Type: String
Necessity: Conditional
Specifies the Certificate Authority (CA) file that contains trusted certificates for verifying the certificate presented to the endpoint from mongod. The file must contain an X.509 certificate collection in PEM format. If you specify this option, mongot uses this file instead of the system keystore. If you configure [syncSource.replicaSet.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.replicaSet.x509) or [syncSource.router.x509](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-syncSource.router.x509), this setting is required.

```
mongod
```

```
mongot
```

```
syncSource.replicaSet.x509
```

```
syncSource.router.x509
```

```
server
```

Type: Object
Necessity: Required
Settings for the mongot query servers.

```
mongot
```

```
server.grpc
```

Type: Object
Necessity: Optional
Listen server settings for gRPC communication between the mongot and mongod processes. If omitted, MongoDB doesn't start the gRPC listen server.

```
mongot
```

```
mongod
```

```
server.grpc.address
```

Type: String
Necessity: Required
Address on which the gRPC listen server will listen. Address must be in the following format:

```
<host>:<port>
```

```
<host>:<port>
```

## Warning
Depending on your system topology, it may be necessary to bind the mongot query server to an interface accessible from your MongoDb Cluster. While binding to the 0.0.0.0 IP address is permitted, it exposes the server to all public networks and carries the risk of unauthorized access.

```
mongot
```

```
0.0.0.0
```

To enhance security, consider restricting server.grpc.address to specific interfaces that are controlled and protected at the network layer such as localhost or other trusted internal addresses.

```
server.grpc.address
```

```
localhost
```

```
server.grpc.tls
```

Type: Object
Necessity: Optional
TLS configuration options for the gRPC listen server.

```
tls
```

```
server.grpc.tls.mode
```

Type: String
Necessity: Required
The TLS mode for the gRPC server. Must be either "TLS", "mTLS", or "disabled".

```
"TLS"
```

```
"mTLS"
```

```
"disabled"
```

```
server.grpc.tls.certificateKeyFile
```

Type: String
Necessity: Conditional
Required when tls.mode is "TLS" or "mTLS". Specifies the PEM file that contains a valid X.509 certificate for mongot using a PKCS#8 private key. mongod validates this certificate using a Certificate Authority (CA) file that you specify with the mongod --tlsCAFile option.

```
tls.mode
```

```
"TLS"
```

```
"mTLS"
```

```
mongot
```

```
mongod
```

```
mongod
```

```
--tlsCAFile
```

```
server.grpc.tls.caFile
```

Type: String
Necessity: Conditional
Required when tls.mode is "mTLS". Specifies the Certificate Authority (CA) file that contains trusted certificates for verifying the certificate presented to the endpoint from mongod. The file must contain an X.509 certificate collection in PEM format.

```
tls.mode
```

```
"mTLS"
```

```
mongod
```

```
server.name
```

Type: String
Necessity: Optional
A user provided name to identify a mongot instance. MongoDB uses server.name to identify mongot hosts across programmatic interfaces such as [$listSearchIndexes](https://www.mongodb.com/docs/manual/reference/operator/aggregation/listSearchIndexes/#mongodb-pipeline-pipe.-listSearchIndexes). If you do not specify a server.name, MongoDB generates one.

```
mongot
```

```
server.name
```

```
mongot
```

```
$listSearchIndexes
```

```
server.name
```

```
storage.dataPath
```

Type: String
Necessity: Required
Path that mongot must use as a base path for storing index data, and the local index catalog.

```
mongot
```

```
embedding
```

Type: Object
Necessity: Optional
Settings for automatically generating embeddings using the Voyage AI models.

```
embedding.queryKeyFile
```

Type: String
Necessity: Required
Path to file that contains the Voyage AI API key. MongoDB Vector Search uses the API key in the specified file to generate embeddings for the query text.

```
embedding.indexingKeyFile
```

Type: String
Necessity: Required
Path to file that contains the Voyage AI API key. MongoDB Vector Search uses the API key in the specified file to generate embeddings during indexing.

```
embedding.providerEndpoint
```

Type: String
Necessity: Optional
Default: https://ai.mongodb.com/v1/embeddings

```
https://ai.mongodb.com/v1/embeddings
```

Endpoint URL to use for generating embeddings. The value depends on whether you create the API keys from the [Atlas UI](https://dochub.mongodb.org/core//voyage-api-keys) or directly from [Voyage AI.](https://docs.voyageai.com/docs/api-key-and-installation)
For API keys created from the:
- Atlas UI, value is https://ai.mongodb.com/v1/embeddings
- Voyage AI, value is https://api.voyageai.com/v1/embeddings
Atlas UI, value is https://ai.mongodb.com/v1/embeddings

```
https://ai.mongodb.com/v1/embeddings
```

Voyage AI, value is https://api.voyageai.com/v1/embeddings

```
https://api.voyageai.com/v1/embeddings
```

```
embedding.isAutoEmbeddingViewWriter
```

Type: Boolean
Necessity: Required
Flag to designate the leader mongot instance responsible for writing the automated embedding View. If you have multiple mongot instances for replica sets or sharded clusters, ensure that only one instance writes the automated embeddings View to prevent duplication or conflicts. Set the value to:

```
mongot
```

```
mongot
```

- true to designate a mongot instance as the leader responsible for
writing the auto-embeddings View.
- false to designate a mongot instance as follower that doesn't
write auto-embeddings View.
true to designate a mongot instance as the leader responsible for writing the auto-embeddings View.

```
true
```

```
mongot
```

false to designate a mongot instance as follower that doesn't write auto-embeddings View.

```
false
```

```
mongot
```

```
metrics
```

Type: Object
Necessity: Optional
Settings for the mongot Prometheus metrics endpoint listener.

```
mongot
```

```
metrics.enabled
```

Type: Boolean
Necessity: Required

Flag that enables the Prometheus metric endpoint. If false, MongoDB parses and validates the syntax of the other configuration options in the metrics block, but doesn't start metrics listener.

```
false
```

```
metrics.address
```

Type: String
Necessity: Optional
Socket address (IPv4/6) on which the Prometheus /metrics endpoint is exposed. Address must be in the following format:

```
/metrics
```

```
<host>:<port>
```

```
<host>:<port>
```

If omitted, defaults to the following address:

```
localhost:9946
```

```
localhost:9946
```

```
ftdc
```

Type: Object
Necessity: Optional
Configuration for capturing FTDC metrics for mongot.

```
mongot
```

```
ftdc.enabled
```

Type: Boolean
Necessity: Optional
Default: true
Flag to enable collection and logging of FTDC data. If omitted, defaults to true. If false, mongot parses FTDC data, but doesn't log it.

```
true
```

```
false
```

```
mongot
```

```
ftdc.directorySizeMb
```

Type: Integer
Necessity: Optional
Default: 100 MiB
Minimum: 10 MiB
Maximum size in mebibytes of the diagnostic.data directory. When the directory size exceeds this value, mongot automatically deletes the oldest diagnostic file.

```
diagnostic.data
```

```
mongot
```

The minimum value for directorySizeMb is ten mebibytes and it must be greater than the maximum file size defined in the [ftdc.fileSizeMb](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-ftdc.fileSizeMb) setting.

```
directorySizeMb
```

```
ftdc.fileSizeMb
```

```
ftdc.fileSizeMb
```

Type: Integer
Necessity: Optional
Default: 10 MiB
Minimum: 1 MiB
Maximum size in mebibytes of each diagnostic file. When the file reaches the maximum size, mongot creates a new file.

```
mongot
```

The minimum value for fileSizeMb is one mebibyte.

```
fileSizeMb
```

```
ftdc.collectionPeriodMillis
```

Type: Integer
Necessity: Optional
Default: 1000 ms
Minimum: 100 ms
Interval of time, in milliseconds, at which mongot collects diagnostic data. If omitted, defaults to one thousand milliseconds.
The minimum value for collectionPeriodMillis is one hundred milliseconds.

```
collectionPeriodMillis
```

```
healthCheck
```

Type: Object
Necessity: Optional
Setting for the mongot health check endpoint. You can't disable the health check endpoint, but you can configure its listen address.

```
mongot
```

```
healthCheck.address
```

Type: String
Necessity: Optional
Address on which the health check listen server listens. Address must be in the following format:

```
<host>:<port>
```

```
<host>:<port>
```

If omitted, defaults to the following address:

```
localhost:8080
```

```
localhost:8080
```

```
logging
```

Type: Object
Necessity: Optional
Options for logging.

```
logging.verbosity
```

Type: String
Necessity: Optional
Verbosity of logging. Value must be a valid Logback log level. If omitted, defaults to INFO.

```
INFO
```

```
logging.logPath
```

Type: String
Necessity: Optional
Path to a file where logs must be written using a Logback file appender. If omitted, MongoDB doesn't create or configure log file appender.

```
mongos
```

```
replication: localPingThresholdMs: <int>sharding: configDB: <string>
```

```
replication: localPingThresholdMs: <int>sharding: configDB: <string>
```

```
replication.localPingThresholdMs
```

Type: integer
Default: 15

```
mongos
```

```

```

When [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) receives a request that permits reads to [secondary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-secondary) members, the [mongos:](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

```
mongos
```

```
mongos
```

- Finds the member of the set with the lowest ping time.
- Constructs a list of replica set members that is within a ping time of
15 milliseconds of the nearest suitable member of the set.If you specify a value for the
[replication.localPingThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.localPingThresholdMs) option,
[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) construct the list of replica members that are
within the latency allowed by this value.
- Selects a member to read from at random from this list.
Finds the member of the set with the lowest ping time.
Constructs a list of replica set members that is within a ping time of 15 milliseconds of the nearest suitable member of the set.
If you specify a value for the [replication.localPingThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.localPingThresholdMs) option, [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) construct the list of replica members that are within the latency allowed by this value.

```
replication.localPingThresholdMs
```

```
mongos
```

Selects a member to read from at random from this list.
The ping time used for a member compared by the [replication.localPingThresholdMs](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-replication.localPingThresholdMs) setting is a moving average of recent ping times, calculated at most every 10 seconds. As a result, some queries may reach members above the threshold until the [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) recalculates the average.

```
replication.localPingThresholdMs
```

```
mongos
```

See the [Read Preference for Replica Sets](https://www.mongodb.com/docs/manual/core/read-preference-mechanics/#std-label-replica-set-read-preference-behavior-member-selection) section of the [read preference](https://www.mongodb.com/docs/manual/core/read-preference/#std-label-read-preference) documentation for more information.

```
sharding.configDB
```

Type: string
The [configuration servers](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server) for the [sharded cluster.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-sharded-cluster)
Config servers for sharded clusters are deployed as a [replica set](https://www.mongodb.com/docs/manual/replication/). The replica set config servers must run the [WiredTiger storage engine.](https://www.mongodb.com/docs/manual/core/wiredtiger/)
Specify the config server replica set name and the hostname and port of at least one of the members of the config server replica set.

```
sharding: configDB: <configReplSetName>/cfg1.example.net:27019, cfg2.example.net:27019,...
```

```
sharding: configDB: <configReplSetName>/cfg1.example.net:27019, cfg2.example.net:27019,...
```

The [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances for the sharded cluster must specify the same config server replica set name but can specify hostname and port of different members of the replica set.

```
mongos
```

```
processManagement: windowsService: serviceName: <string> displayName: <string> description: <string> serviceUser: <string> servicePassword: <string>
```

```
processManagement: windowsService: serviceName: <string> displayName: <string> description: <string> serviceUser: <string> servicePassword: <string>
```

```
processManagement.windowsService.serviceName
```

Type: string
Default: MongoDB
The service name of [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod when running as a Windows Service. Use this name with the net start <name> and net stop <name> operations.

```
mongos
```

```
mongod
```

```
net start <name>
```

```
net stop <name>
```

You must use [processManagement.windowsService.serviceName](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.windowsService.serviceName) in conjunction with either the --install or --remove option.

```
processManagement.windowsService.serviceName
```

```
--install
```

```
--remove
```

```
processManagement.windowsService.displayName
```

Type: string
Default: MongoDB
The name listed for MongoDB on the Services administrative application.

```
processManagement.windowsService.description
```

Type: string
Default: MongoDB Server
Run [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod service description.

```
mongos
```

```
mongod
```

You must use [processManagement.windowsService.description](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.windowsService.description) in conjunction with the --install option.

```
processManagement.windowsService.description
```

```
--install
```

For descriptions that contain spaces, you must enclose the description in quotes.

```
processManagement.windowsService.serviceUser
```

Type: string
The [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod service in the context of a certain user. This user must have "Log on as a service" privileges.

```
mongos
```

```
mongod
```

You must use [processManagement.windowsService.serviceUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.windowsService.serviceUser) in conjunction with the --install option.

```
processManagement.windowsService.serviceUser
```

```
--install
```

```
processManagement.windowsService.servicePassword
```

Type: string
The password for <user> for [mongos](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) or mongod when running with the [processManagement.windowsService.serviceUser](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.windowsService.serviceUser) option.

```
<user>
```

```
mongos
```

```
mongod
```

```
processManagement.windowsService.serviceUser
```

You must use [processManagement.windowsService.servicePassword](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-processManagement.windowsService.servicePassword) in conjunction with the --install option.

```
processManagement.windowsService.servicePassword
```

```
--install
```

MongoDB removed the deprecated MMAPv1 storage engine and the MMAPv1-specific configuration options:
storage.mmapv1.journal.commitIntervalMs

```
storage.mmapv1.journal.commitIntervalMs
```

storage.mmapv1.journal.debugFlags

```
storage.mmapv1.journal.debugFlags
```

mongod --journalOptions

```
mongod --journalOptions
```

storage.mmapv1.nsSize

```
storage.mmapv1.nsSize
```

mongod --nssize

```
mongod --nssize
```

storage.mmapv1.preallocDataFiles

```
storage.mmapv1.preallocDataFiles
```

mongod --noprealloc

```
mongod --noprealloc
```

storage.mmapv1.quota.enforced

```
storage.mmapv1.quota.enforced
```

mongod --quota

```
mongod --quota
```

storage.mmapv1.quota.maxFilesPerDB

```
storage.mmapv1.quota.maxFilesPerDB
```

mongod --quotaFiles

```
mongod --quotaFiles
```

storage.mmapv1.smallFiles

```
storage.mmapv1.smallFiles
```

mongod --smallfiles

```
mongod --smallfiles
```

storage.repairPath

```
storage.repairPath
```

mongod --repairpath

```
mongod --repairpath
```

replication.secondaryIndexPrefetch

```
replication.secondaryIndexPrefetch
```

mongod --replIndexPrefetch

```
mongod --replIndexPrefetch
```

For earlier versions of MongoDB, refer to the [legacy documentation](https://www.mongodb.com/docs/legacy/).
Back
Manage mongod Processes

Next
Externally Sourced Configuration File Values
On this page
- [Use the Configuration File](https://www.mongodb.com/docs/manual/reference/configuration-options/#use-the-configuration-file)

- [processManagement Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#processmanagement-options)
- [net Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#net-options)
- [security Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#security-options)
- [setParameter Option](https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-option)
- [setParameter LDAP Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-ldap-options)
- [setParameter MongoDB Search Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-mongodb-search-options)
- [storage Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#storage-options)
- [operationProfiling Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#operationprofiling-options)
- [replication Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#replication-options)
- [sharding Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#sharding-options)
- [auditLog Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#auditlog-options)
- [mongot Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongotoptions)
- [mongos -only Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongos-only-options)
- [Windows Service Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#windows-service-options)
- [Removed MMAPv1 Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#removed-mmapv1-options)
- Configuration File
- File Format
- Use the Configuration File
- Core Options

```
systemLog
```

- processManagement Options

```
processManagement
```

- net Options

```
net
```

- security Options

```
security
```

- setParameter Option

```
setParameter
```

- setParameter LDAP Options

```
setParameter
```

- setParameter MongoDB Search Options

```
setParameter
```

- storage Options

```
storage
```

- operationProfiling Options

```
operationProfiling
```

- replication Options

```
replication
```

- sharding Options

```
sharding
```

- auditLog Options

```
auditLog
```

- mongot Options

```
mongot
```

- mongos -only Options

```
mongos
```

- Windows Service Options
- Removed MMAPv1 Options
On this page
- [Configuration File](https://www.mongodb.com/docs/manual/reference/configuration-options/#configuration-file)
- [File Format](https://www.mongodb.com/docs/manual/reference/configuration-options/#file-format)
- [Use the Configuration File](https://www.mongodb.com/docs/manual/reference/configuration-options/#use-the-configuration-file)
- [Core Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#core-options)
- [systemLog Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#systemlog-options)
- [processManagement Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#processmanagement-options)
- [net Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#net-options)
- [security Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#security-options)
- [setParameter Option](https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-option)
- [setParameter LDAP Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-ldap-options)
- [setParameter MongoDB Search Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#setparameter-mongodb-search-options)
- [storage Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#storage-options)
- [operationProfiling Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#operationprofiling-options)
- [replication Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#replication-options)
- [sharding Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#sharding-options)
- [auditLog Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#auditlog-options)
- [mongot Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongotoptions)
- [mongos -only Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongos-only-options)
- [Windows Service Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#windows-service-options)
- [Removed MMAPv1 Options](https://www.mongodb.com/docs/manual/reference/configuration-options/#removed-mmapv1-options)
- Configuration File
- File Format

- Use the Configuration File
- Core Options
- systemLog Options

```
systemLog
```

- processManagement Options

```
processManagement
```

- net Options

```
net
```

- security Options

```
security
```

- setParameter Option

```
setParameter
```

- setParameter LDAP Options

```
setParameter
```

- setParameter MongoDB Search Options

```
setParameter
```

- storage Options

```
storage
```

- operationProfiling Options

```
operationProfiling
```

- replication Options

```
replication
```

- sharding Options

```
sharding
```

- auditLog Options

```
auditLog
```

- mongot Options

```
mongot
```

- mongos -only Options

```
mongos
```

- Windows Service Options
- Removed MMAPv1 Options
