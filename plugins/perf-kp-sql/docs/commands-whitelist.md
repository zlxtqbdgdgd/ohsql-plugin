# 远程只读命令执行规则

## 触发场景
当需要在远程服务器执行模板之外的只读命令（如 mongosh 查询、iostat、查看日志）时，使用内置 SSH 通道。

## 白名单（只允许以下前缀开头的命令）
`mongosh`, `mongo`, `cat`, `grep`, `ls`, `iostat`, `vmstat`, `mpstat`,
`top -bn`, `free`, `df`, `uname`, `lscpu`, `numactl`, `sysctl`,
`ps`, `netstat`, `ss`, `uptime`, `whoami`, `id`, `head`, `tail`,
`wc`, `awk`, `sort`, `uniq`, `echo`,
`systemctl status`, `systemctl is-active`, `systemctl is-enabled`,
`journalctl`, `pgrep`, `which`, `hostname`, `date`, `findmnt`, `mount`,
`ip addr`, `ip route`,
`sar`, `last`, `dmesg`, `perf stat`, `perf top`, `/proc/`,
`readelf`, `ldd`, `getconf`

## 黑名单（任何命令包含以下模式一律拒绝）
`rm`, `rmdir`, `dd`, `mkfs`, `> /`, `tee /`, `chmod`, `chown`,
`kill`, `killall`, `reboot`, `shutdown`, `halt`, `poweroff`,
`systemctl stop`, `systemctl disable`, `service stop`,
`pip install`, `npm install`, `yum install`, `apt install`,
`curl`, `wget`, `scp`, `rsync`, `sudo su`, `su -`

## 处理规则
- 命令命中白名单 + 不命中黑名单 → 执行
- 命令被拒绝时（非只读命令）：将命令输出给用户让其在服务器手动执行，格式：
  ```
  请在服务器上执行以下只读命令，并将输出发给我：
  sh
  mongosh --quiet --eval 'db.adminCommand({currentOp: true, $all: true})'
  ```
