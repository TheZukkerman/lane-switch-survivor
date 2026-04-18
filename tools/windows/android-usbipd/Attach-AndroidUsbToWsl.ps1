[CmdletBinding(DefaultParameterSetName='Auto')]
param(
    [Parameter(ParameterSetName='BusId')]
    [ValidatePattern('^[0-9-]+$')]
    [string]$BusId,

    [Parameter(ParameterSetName='Auto')]
    [switch]$ListOnly,

    [string]$Distro,

    [switch]$SkipBind
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail($Message) {
    Write-Error $Message
    exit 1
}

function Get-UsbipdJson() {
    $raw = & usbipd list --json 2>$null
    if (-not $raw) {
        Fail 'usbipd list --json returned no data. Is usbipd installed and available in PATH?'
    }

    try {
        return $raw | ConvertFrom-Json
    }
    catch {
        Fail 'Could not parse usbipd JSON output. Please update usbipd-win.'
    }
}

function Get-Items($Json) {
    if ($Json.PSObject.Properties.Name -contains 'Devices') { return @($Json.Devices) }
    if ($Json.PSObject.Properties.Name -contains 'devices') { return @($Json.devices) }
    return @($Json)
}

function Get-Prop($Object, [string[]]$Names) {
    foreach ($name in $Names) {
        if ($Object.PSObject.Properties.Name -contains $name) {
            return $Object.$name
        }
    }
    return $null
}

function Test-AndroidLikeDevice($Device) {
    $text = @(
        (Get-Prop $Device @('description','Description')),
        (Get-Prop $Device @('busId','BusId')),
        (Get-Prop $Device @('hardwareId','HardwareId')),
        (Get-Prop $Device @('instanceId','InstanceId')),
        (Get-Prop $Device @('vidPid','VidPid')),
        (Get-Prop $Device @('clientWslInstance','ClientWslInstance'))
    ) -join ' '

    return $text -match '(?i)android|adb|fastboot|google|pixel|samsung|oneplus|xiaomi|nothing|motorola|hmd|nexus|sony|oppo|vivo|realme|honor|huawei'
}

function Select-AndroidDevices($Devices) {
    return @($Devices | Where-Object { Test-AndroidLikeDevice $_ })
}

function Format-DeviceLine($Device) {
    $busId = Get-Prop $Device @('busId','BusId')
    $desc = Get-Prop $Device @('description','Description')
    $state = Get-Prop $Device @('state','State')
    $attached = Get-Prop $Device @('clientWslInstance','ClientWslInstance')
    if (-not $attached) { $attached = '-' }
    return '{0,-8} {1,-12} {2} | attached:{3}' -f $busId, $state, $desc, $attached
}

if (-not (Get-Command usbipd -ErrorAction SilentlyContinue)) {
    Fail 'usbipd command not found. Install usbipd-win first.'
}

$json = Get-UsbipdJson
$devices = Get-Items $json
$androidDevices = Select-AndroidDevices $devices

if (-not $androidDevices -or $androidDevices.Count -eq 0) {
    Fail 'No Android-like USB devices detected by usbipd. Connect the phone with USB debugging enabled and accept the trust prompt on the phone.'
}

Write-Host 'Android-like USB devices detected:'
$androidDevices | ForEach-Object { Write-Host ('  ' + (Format-DeviceLine $_)) }

if ($ListOnly) {
    exit 0
}

$selected = $null
if ($PSCmdlet.ParameterSetName -eq 'BusId') {
    $selected = $androidDevices | Where-Object { (Get-Prop $_ @('busId','BusId')) -eq $BusId }
    if (-not $selected) {
        Fail "BUSID '$BusId' was not found among Android-like devices above."
    }
}
else {
    if ($androidDevices.Count -gt 1) {
        Fail 'More than one Android-like USB device detected. Re-run with -BusId <BUSID> to choose one explicitly.'
    }
    $selected = $androidDevices[0]
}

$selectedBusId = Get-Prop $selected @('busId','BusId')
$selectedDesc = Get-Prop $selected @('description','Description')

if (-not $SkipBind) {
    Write-Host "Binding $selectedBusId ($selectedDesc) for sharing..."
    & usbipd bind --busid $selectedBusId
}

$attachArgs = @('attach', '--wsl', '--busid', $selectedBusId)
if ($Distro) {
    $attachArgs += @('--distribution', $Distro)
}

Write-Host "Attaching $selectedBusId ($selectedDesc) to WSL..."
& usbipd @attachArgs

Write-Host ''
Write-Host 'Attach command finished.'
Write-Host 'Inside WSL you can verify with: lsusb or adb devices'
