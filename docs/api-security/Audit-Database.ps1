param([string]$OutputPath='docs/api-security/database-final-audit.json',
      [string]$CountBaseline='docs/api-security/database-continuation-baseline.json')
$ErrorActionPreference='Stop'
$config=Get-Content 'src/main/resources/application.yaml' -Raw
$dbPassword=[regex]::Match($config,'(?m)^\s*password:\s*(.+?)\s*$').Groups[1].Value.Trim().Trim([char]34).Trim([char]39)
$previousMysqlPassword=$env:MYSQL_PWD
try {
 $env:MYSQL_PWD=$dbPassword
 function Query([string]$sql) {
   $result=& 'C:\Program Files\MySQL\MySQL Server 26.7\bin\mysql.exe' --host=127.0.0.1 --port=3307 --user=root --database=apple_repair_service --default-character-set=utf8mb4 --batch --raw --skip-column-names --execute=$sql 2>&1
   if($LASTEXITCODE -ne 0) { throw 'MySQL audit query failed' }
   return $result
 }
 $tables=@(Query 'SHOW TABLES;')
 $counts=@()
 foreach($table in $tables) {
   if($table -notmatch '^[a-z_]+$') {throw 'Unexpected table name'}
   $count=Query "SELECT COUNT(*) FROM $table"
   $counts += [PSCustomObject]@{table=$table;count=[long]$count}
 }
 $sql=@'
SELECT JSON_OBJECT('kind','column','table',TABLE_NAME,'column',COLUMN_NAME,'type',COLUMN_TYPE,'nullable',IS_NULLABLE,'default',COLUMN_DEFAULT,'extra',EXTRA,'collation',COLLATION_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE();
SELECT JSON_OBJECT('kind','fk','table',k.TABLE_NAME,'name',k.CONSTRAINT_NAME,'column',k.COLUMN_NAME,'targetTable',k.REFERENCED_TABLE_NAME,'targetColumn',k.REFERENCED_COLUMN_NAME,'deleteRule',r.DELETE_RULE,'updateRule',r.UPDATE_RULE) FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL;
SELECT JSON_OBJECT('kind','index','table',TABLE_NAME,'name',INDEX_NAME,'nonUnique',NON_UNIQUE,'columns',GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',')) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_NAME,INDEX_NAME,NON_UNIQUE;
'@
 $schema=@(Query $sql | ForEach-Object {$_ | ConvertFrom-Json})
 function Canonical($items) {
   @($items | ForEach-Object {
     $ordered=[ordered]@{}; $_.PSObject.Properties | Sort-Object Name | ForEach-Object {$ordered[$_.Name]=$_.Value}
     $ordered | ConvertTo-Json -Compress
   } | Sort-Object)
 }
 $original=(Get-Content 'docs/api-security/schema-baseline.json' -Raw | ConvertFrom-Json).schema
 $schemaDifferences=@(Compare-Object (Canonical $original) (Canonical $schema))
 $countDifferences=@()
 if(Test-Path $CountBaseline) {
   $previous=(Get-Content $CountBaseline -Raw | ConvertFrom-Json).counts
   $countDifferences=@(Compare-Object (Canonical $previous) (Canonical $counts))
 }
 $audit=[PSCustomObject]@{date=[DateTimeOffset]::Now.ToString('o');endpoint='localhost:3307/apple_repair_service';
   tables=$tables;tableCount=$tables.Count;counts=$counts;columnCount=@($schema|Where-Object kind -eq 'column').Count;
   foreignKeyCount=@($schema|Where-Object kind -eq 'fk').Count;indexCount=@($schema|Where-Object kind -eq 'index').Count;
   schemaDifferences=$schemaDifferences;countDifferences=$countDifferences;schema=$schema}
 $audit | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
 $audit | Select-Object endpoint,tableCount,columnCount,foreignKeyCount,indexCount,@{n='schemaDifferenceCount';e={$_.schemaDifferences.Count}},@{n='rowCountDifferenceCount';e={$_.countDifferences.Count}} | ConvertTo-Json
} finally { $env:MYSQL_PWD=$previousMysqlPassword }

