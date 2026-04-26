# 修复命令模板

## 渐进式披露原则
- 初始报告只列建议标题 + 风险等级 + `[参考N]` 引用标记
- 用户回复对应编号时，展开完整三段式（修改命令 + 回滚命令 + 验证命令）

## 三段式格式

### 示例 1：关闭 THP
```
修改命令：
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled

回滚命令：
echo always | sudo tee /sys/kernel/mm/transparent_hugepage/enabled

验证命令：
cat /sys/kernel/mm/transparent_hugepage/enabled
```
（若 grep 到 `[never]` → 修改生效）

### 示例 2：调整 WT 缓存
```
修改命令：
mongosh --quiet --eval 'db.adminCommand({setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=8G"})'

回滚命令：
mongosh --quiet --eval 'db.adminCommand({setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=<原值>G"})'

验证命令：
mongosh --quiet --eval 'JSON.stringify(db.serverStatus().wiredTiger.cache["maximum bytes configured"])'
```

### 示例 3：调整 vm.swappiness
```
修改命令：
sudo sysctl -w vm.swappiness=1

回滚命令：
sudo sysctl -w vm.swappiness=<原值>

验证命令：
cat /proc/sys/vm/swappiness
```

## 风险等级标注
- **低**：不影响业务（只读参数、日志级别、可立即回滚）
- **中**：短暂影响（瞬时抖动、需要连接重连）
- **高**：需重启（mongod.conf 变更、重启服务生效的参数）

## 执行后验证流程
当用户说"已执行/改好了/done"时：
1. 立即执行验证命令（只读）确认修改已生效
2. 如涉及多处修改，重跑基线诊断做全面复查
3. 对比修复前后结果，告知用户状态变化（如 CRITICAL → OK）
4. 如验证失败，告知可能原因（权限不足 / 需重启 / 参数名拼错）
