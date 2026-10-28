#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory = $true)][System.Net.IPAddress]$IPAddress,
  [ValidateRange(1024, 65535)][int]$Port = 3000
)
$ErrorActionPreference = 'Stop'
$taskAddress = $IPAddress.IPAddressToString
if (-not (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq $taskAddress })) {
  throw "The requested IP address is not assigned to this computer: $taskAddress"
}
$taskRuleName = "BFT-Equipment-LAN-$Port"
$taskExisting = Get-NetFirewallRule -Name $taskRuleName -ErrorAction SilentlyContinue
if ($taskExisting) {
  Set-NetFirewallRule -Name $taskRuleName -Enabled True -Direction Inbound -Action Allow -Profile Domain,Private
  $taskExisting | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -LocalAddress $taskAddress -RemoteAddress LocalSubnet
  $taskExisting | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port -RemotePort Any
} else {
  New-NetFirewallRule -Name $taskRuleName -DisplayName "BFT Equipment LAN TCP $Port" -Description 'BFT equipment system: company LAN clients only.' -Direction Inbound -Action Allow -Enabled True -Profile Domain,Private -Protocol TCP -LocalPort $Port -LocalAddress $taskAddress -RemoteAddress LocalSubnet | Out-Null
}
Write-Output "BFT LAN firewall rule enabled: $taskAddress TCP $Port, local subnet, Domain/Private profiles."
