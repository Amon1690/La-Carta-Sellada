[CmdletBinding(SupportsShouldProcess)]
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$startupDirectory = [Environment]::GetFolderPath('Startup')
if (-not $startupDirectory) { throw 'Windows no devolvió la carpeta Inicio del usuario.' }
$shortcutPath = Join-Path $startupDirectory 'La Carta Sellada - Codex.lnk'
$shell = New-Object -ComObject WScript.Shell
$explorerPath = Join-Path $env:WINDIR 'explorer.exe'

if (Test-Path -LiteralPath $shortcutPath) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.Description -ne 'Abrir Codex al iniciar sesión para La Carta Sellada') {
        throw 'El acceso directo existente no pertenece a esta instalación; no se modifica.'
    }
    if ($Remove) {
        if ($PSCmdlet.ShouldProcess($shortcutPath, 'Quitar inicio automático de Codex')) {
            Remove-Item -LiteralPath $shortcutPath
        }
        return
    }
}
if ($Remove) { return }

$apps = @(Get-StartApps | Where-Object { $_.AppID -like 'OpenAI.Codex_*!App' })
if ($apps.Count -ne 1) { throw 'No se identifica una única app Codex/ChatGPT instalada para este usuario.' }
if ($PSCmdlet.ShouldProcess($shortcutPath, 'Abrir la app existente al iniciar sesión en Windows')) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $explorerPath
    $shortcut.Arguments = 'shell:AppsFolder\' + $apps[0].AppID
    $shortcut.Description = 'Abrir Codex al iniciar sesión para La Carta Sellada'
    $shortcut.Save()
    $saved = $shell.CreateShortcut($shortcutPath)
    if ($saved.TargetPath -ne $explorerPath -or $saved.Arguments -ne $shortcut.Arguments) {
        throw 'No se pudo verificar el acceso directo de inicio.'
    }
    Write-Output "Inicio automático configurado: $shortcutPath"
}
