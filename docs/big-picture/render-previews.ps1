$ErrorActionPreference = 'Stop'
$browserCandidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)
$browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browserPath) { throw 'Install Chrome or Edge to render the SVG previews.' }
foreach ($preview in @(
    @{ Name = 'workflow'; Height = 2460 },
    @{ Name = 'brownfield-workflow'; Height = 1770 }
)) {
    $svgPath = Join-Path $PSScriptRoot ($preview.Name + '.svg')
    $pngPath = Join-Path $PSScriptRoot ($preview.Name + '.png')
    $svgUri = ([System.Uri]$svgPath).AbsoluteUri
    $browserArgs = @(
        '--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
        ('--screenshot="' + $pngPath + '"'),
        ('--window-size=1800,' + $preview.Height),
        '--force-device-scale-factor=1', $svgUri
    )
    $process = Start-Process -FilePath $browserPath -ArgumentList $browserArgs -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $pngPath)) {
        throw "Preview rendering failed for $svgPath"
    }
    Write-Output "Rendered $pngPath"
}
