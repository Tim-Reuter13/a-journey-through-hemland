# Second opinion: Codex reviews the same contact sheets with the same instructions (review_prompt.md).
# Writes qc\review_codex.json. Run after the sheets in qc\review are fresh.
$ErrorActionPreference = 'Stop'
$film = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg = Get-AppxPackage OpenAI.Codex
$codex = Join-Path $pkg.InstallLocation 'app\resources\codex.exe'
$sheets = Get-ChildItem (Join-Path $film 'qc\review\shot_*.jpg') | Sort-Object Name
$cargs = @('exec', '-C', $film, '-s', 'read-only', '--skip-git-repo-check', '-m', 'gpt-6.2-sol', '-c', 'model_reasoning_effort="medium"')
foreach ($s in $sheets) { $cargs += @('-i', $s.FullName) }
$prompt = (Get-Content (Join-Path $film 'review_prompt.md') -Raw) + @"

The attached images are qc/review/shot_01.jpg ... shot_17.jpg in this order. The automatic checks are in qc/review_auto.json.
Answer with the JSON object only.
"@
$prompt | & $codex @cargs - 2>&1 | Out-File -Encoding utf8 (Join-Path $film 'qc\review_codex.log')
# keep the last JSON object of the log
$log = Get-Content (Join-Path $film 'qc\review_codex.log') -Raw
$m = [regex]::Matches($log, '\{\s*"issues"[\s\S]*?"summary"\s*:\s*"[^"]*"\s*\}')
if ($m.Count) { $m[$m.Count - 1].Value | Out-File -Encoding utf8 (Join-Path $film 'qc\review_codex.json'); 'CODEX_REVIEW_OK' } else { 'CODEX_REVIEW_NO_JSON' }
