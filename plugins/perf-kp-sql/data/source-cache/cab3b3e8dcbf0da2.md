<!-- source URL cache · perf-kp-sql LLM-as-Judge (a3) input -->
<!-- url: https://jira.mongodb.org/browse/SERVER-33296 -->
<!-- url_final: https://jira.mongodb.org/browse/SERVER-33296 -->
<!-- fetched_at: 2026-05-03T18:11:03.242Z -->
<!-- html_bytes: 146325 · text_chars: 3415 -->
<!-- used_by_cases: 1 -->
Loading... 

Log in Skip to main content Skip to sidebar Dashboards 
Projects 
Issues 
eazyBI 

Give feedback to Atlassian 

Help 

Keyboard Shortcuts 

About Jira 

Jira Credits 

Log In 

Acknowledged notifications 






Core Server 
SERVER-33296 
Excessive memory usage due to heap fragmentation

Undo Transition 
Backlog "> Backlog 

Export 

null XML Word Printable JSON 

Details 

Type: 

Bug

Resolution: 

Unresolved

Priority: 

Major - P3 

Fix Version/s: 

None

Affects Version/s: 

3.6.2 

Component/s: 

WiredTiger 

Labels: 

malloc 

memory-management 

perf-effort-xlarge 

perf-improve-product 

perf-urgency-asap 

perf-value-essential 

tcmalloc 

Field Tab 

Aha! Info 

Assigned Teams: 

Product Performance 

Operating System: 

Linux

Steps To Reproduce: 

Hide 

david.daly - Handing over to you per e-mail discussion.

Show 

david.daly - Handing over to you per e-mail discussion. 

Sprint: 

Dev Tools 2019-05-06, Dev Tools 2019-04-22

Case: 







(copied to CRM) 

CAR Domain/s: 

None

Aha! Reference: 

None

Tracking Level: 

None

Risk Status: 

None

Exec Notes: 

None

Goal Name(s): 

None

Goal Link: 

None

Description 

The changes described in SERVER-20306 eliminated a common source of memory fragmentation, but it can still occur for other reasons. Here's an example from a node undergoing initial sync:

Over time

allocated memory never exceeds 8 GB

but heap size and resident memory reach nearly 14 GB

this is due to an accumulation of pageheap_free_bytes

A common cause of this is a shifting distribution of allocated memory sizes, which leaves free pages dedicated to one size of buffer unable to be used for new memory requests because they are for a different size buffer.

Setting TCMALLOC_AGGRESSIVE_DECOMMIT can address this issue by causing tcmalloc to aggressively return the free pages to the o/s where they can then be re-used by tcmalloc to satisfy new memory requests. However can have an unacceptable negative performance impact. Is there a tweak to tcmalloc that can give us better behavior for workloads like this?

Attachments 

Attachments 
Options Sort By Name 
Sort By Date 
Ascending 
Descending 
Thumbnails 
List 
Download All 

4.3.3-rr100.png 330 kB Jan 31 2020 10:46:15 AM UTC 

fragmentation.png 104 kB Feb 13 2018 06:56:08 PM UTC 

fragmentation-3.6.2.png 107 kB Feb 14 2018 02:23:29 PM UTC 

image-2019-10-21-15-09-33-867.png 225 kB Oct 21 2019 12:09:36 PM UTC 

Issue Links 

is duplicated by 

SERVER-37541 
MongoDB Not Returning Free Space to OS 

Closed 

related to 

SERVER-39325 
Add support for "allocator=jemalloc" 

Backlog 

SERVER-35046 
Add parameter to set tcmalloc aggressive decommit 

Closed 

SERVER-31417 
Improve tcmalloc when decommitting large amounts of memory 

Closed 

mentioned in 

Page Loading... 

Activity 

People 

Assignee: 

[DO NOT USE] Backlog - Performance Team

Reporter: 

Bruce Lucas (Inactive)

Participants: 

[DO NOT USE] Backlog - Performance Team , Andrew Shuvalov , Bruce Lucas , Eran Davidi , Ian Whalen 

Votes : 

8 

Vote for this issue 

Watchers: 

69 

Start watching this issue 

Dates 

Created:

Feb 13 2018 06:49:44 PM UTC 

Updated:

Apr 23 2026 08:58:30 PM UTC 

Atlassian Jira Project Management Software 

About Jira 

Report a problem 

Powered by a free Atlassian Jira open source license for MongoDB. Try Jira - bug tracking software for your team.

Atlassian
