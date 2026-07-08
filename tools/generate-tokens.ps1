param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$NerezzaOnly
)

Add-Type -AssemblyName System.Drawing

$npcSources = @(
  @{ File = 'atlas-01-hawkwinter.png'; Entries = @(
    @{ Id = 'lord-edric-hawkwinter'; Quadrant = 'tl' },
    @{ Id = 'hermana-elen'; Quadrant = 'tr' },
    @{ Id = 'sir-cedric-stone'; Quadrant = 'bl' },
    @{ Id = 'owen-harrow'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-02-guardia.png'; Entries = @(
    @{ Id = 'marcus-flint'; Quadrant = 'tl' },
    @{ Id = 'hugo-tanner'; Quadrant = 'tr' },
    @{ Id = 'edwin-cole'; Quadrant = 'bl' },
    @{ Id = 'roland-ashford'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-03-servicio.png'; Entries = @(
    @{ Id = 'thomas-weaver'; Quadrant = 'tl' },
    @{ Id = 'madre-marta'; Quadrant = 'tr' },
    @{ Id = 'peter-mozocuadras'; Quadrant = 'bl' },
    @{ Id = 'agatha-ama-llaves'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-04-templo.png'; Entries = @(
    @{ Id = 'elsie-criada'; Quadrant = 'tl' },
    @{ Id = 'bram-jardinero'; Quadrant = 'tr' },
    @{ Id = 'priora-mara-veldan'; Quadrant = 'bl' },
    @{ Id = 'hermano-alaric'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-05-posada.png'; Entries = @(
    @{ Id = 'doran-mieloscura'; Quadrant = 'tl' },
    @{ Id = 'rusk-bandido'; Quadrant = 'tr' },
    @{ Id = 'niles-bandido'; Quadrant = 'bl' },
    @{ Id = 'bren-bandido'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-06-mano-hierro.png'; Entries = @(
    @{ Id = 'oren-bandido'; Quadrant = 'tl' },
    @{ Id = 'garrick-mano-de-hierro'; Quadrant = 'tr' },
    @{ Id = 'kelm-segundo'; Quadrant = 'bl' },
    @{ Id = 'mira-arquera'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-07-amenaza.png'; Entries = @(
    @{ Id = 'tob-vigia'; Quadrant = 'tl' },
    @{ Id = 'harl-veterano'; Quadrant = 'tr' },
    @{ Id = 'hombre-encapuchado'; Quadrant = 'bl' },
    @{ Id = ('guerrero-extra' + [char]0x00F1 + 'o'); Quadrant = 'br' }
  ) },
  @{ File = 'atlas-08-campamento.png'; Entries = @(
    @{ Id = 'varek-herrero'; Quadrant = 'tl' },
    @{ Id = 'silas-rastreador'; Quadrant = 'tr' },
    @{ Id = 'dreg-forzudo'; Quadrant = 'bl' },
    @{ Id = 'finn-tramposo'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-09-testigos.png'; Entries = @(
    @{ Id = ('jorek-le' + [char]0x00F1 + 'ador'); Quadrant = 'tl' },
    @{ Id = 'lena-exploradora'; Quadrant = 'tr' },
    @{ Id = 'oswin-reed'; Quadrant = 'bl' },
    @{ Id = 'hermano-tomas'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-10-escolta.png'; Entries = @(
    @{ Id = 'sargento-aldren-voss'; Quadrant = 'tl' },
    @{ Id = 'guarda-eamon'; Quadrant = 'tr' },
    @{ Id = 'guarda-borik'; Quadrant = 'bl' },
    @{ Id = 'guarda-lyra'; Quadrant = 'br' }
  ) },
  @{ File = 'falso-clerigo.png'; Entries = @(
    @{ Id = 'falso-clerigo'; Quadrant = 'full' }
  ) }
)

$playerSources = @(
  @{ File = 'atlas-01-aventureros.png'; Entries = @(
    @{ Id = 'paladin-entrega'; Quadrant = 'tl' },
    @{ Id = 'pippa-luz-de-luna-brandibuena'; Quadrant = 'bl' },
    @{ Id = 'barbaro-berseker'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-02-arcanos.png'; Entries = @(
    @{ Id = 'brujo-celestial'; Quadrant = 'tl' },
    @{ Id = 'hechicero-draconiano'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-03-viajeros.png'; Entries = @(
    @{ Id = 'explorador-cazador'; Quadrant = 'tl' },
    @{ Id = 'druida-tierra'; Quadrant = 'tr' },
    @{ Id = 'mago-evocador'; Quadrant = 'bl' },
    @{ Id = 'guerrero-maestro-combate'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-04-especialistas.png'; Entries = @(
    @{ Id = 'bardo-conocimiento'; Quadrant = 'tl' },
    @{ Id = 'monje-elementos'; Quadrant = 'bl' }
  ) }
)

$genericSources = @(
  @{ File = 'atlas-01.png'; Entries = @(
    @{ Id = 'aldeano'; Quadrant = 'tl' }, @{ Id = 'campesino'; Quadrant = 'tr' },
    @{ Id = 'nino-callejero'; Quadrant = 'bl' }, @{ Id = 'comerciante'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-02.png'; Entries = @(
    @{ Id = 'mercader-influyente'; Quadrant = 'tl' }, @{ Id = 'artesano'; Quadrant = 'tr' },
    @{ Id = 'herrero'; Quadrant = 'bl' }, @{ Id = 'tabernero'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-03.png'; Entries = @(
    @{ Id = 'erudito'; Quadrant = 'tl' }, @{ Id = 'curandero'; Quadrant = 'tr' },
    @{ Id = 'noble'; Quadrant = 'bl' }, @{ Id = 'mensajero'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-04.png'; Entries = @(
    @{ Id = 'guardia'; Quadrant = 'tl' }, @{ Id = 'guardia-veterano'; Quadrant = 'tr' },
    @{ Id = 'capitan-guardia'; Quadrant = 'bl' }, @{ Id = 'soldado'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-05.png'; Entries = @(
    @{ Id = 'sargento'; Quadrant = 'tl' }, @{ Id = 'caballero'; Quadrant = 'tr' },
    @{ Id = 'veterano'; Quadrant = 'bl' }, @{ Id = 'mercenario'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-06.png'; Entries = @(
    @{ Id = 'acolito'; Quadrant = 'tl' }, @{ Id = 'sacerdote'; Quadrant = 'tr' },
    @{ Id = 'bandido'; Quadrant = 'bl' }, @{ Id = 'arquero-bandido'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-07.png'; Entries = @(
    @{ Id = 'bandido-veterano'; Quadrant = 'tl' }, @{ Id = 'jefe-bandido'; Quadrant = 'tr' },
    @{ Id = 'maton'; Quadrant = 'bl' }, @{ Id = 'ladron'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-08.png'; Entries = @(
    @{ Id = 'espia'; Quadrant = 'tl' }, @{ Id = 'asesino'; Quadrant = 'tr' },
    @{ Id = 'cultista'; Quadrant = 'bl' }, @{ Id = 'fanatico-culto'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-09.png'; Entries = @(
    @{ Id = 'cazador'; Quadrant = 'tl' }, @{ Id = 'explorador'; Quadrant = 'tr' },
    @{ Id = 'rastreador'; Quadrant = 'bl' }, @{ Id = 'guia'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-10.png'; Entries = @(
    @{ Id = 'marinero'; Quadrant = 'tl' }, @{ Id = 'capitan-barco'; Quadrant = 'tr' },
    @{ Id = 'pirata'; Quadrant = 'bl' }, @{ Id = 'minero'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-11.png'; Entries = @(
    @{ Id = 'aprendiz-arcano'; Quadrant = 'tl' }, @{ Id = 'mago-batalla'; Quadrant = 'tr' },
    @{ Id = 'trovador-itinerante'; Quadrant = 'bl' }, @{ Id = 'adepto-druidico'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-12.png'; Entries = @(
    @{ Id = 'goblin-escaramuzador'; Quadrant = 'tl' }, @{ Id = 'goblin-arquero'; Quadrant = 'tr' },
    @{ Id = 'jefe-goblin'; Quadrant = 'bl' }, @{ Id = 'hobgoblin-soldado'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-13.png'; Entries = @(
    @{ Id = 'bugbear-emboscador'; Quadrant = 'tl' }, @{ Id = 'kobold-trampero'; Quadrant = 'tr' },
    @{ Id = 'orco-saqueador'; Quadrant = 'bl' }, @{ Id = 'orco-arquero'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-14.png'; Entries = @(
    @{ Id = 'jefe-orco'; Quadrant = 'tl' }, @{ Id = 'gnoll-cazador'; Quadrant = 'tr' },
    @{ Id = 'esqueleto'; Quadrant = 'bl' }, @{ Id = 'zombi'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-15.png'; Entries = @(
    @{ Id = 'necrofago'; Quadrant = 'tl' }, @{ Id = 'lobo'; Quadrant = 'tr' },
    @{ Id = 'lobo-terrible'; Quadrant = 'bl' }, @{ Id = 'oso-pardo'; Quadrant = 'br' }
  ) },
  @{ File = 'atlas-16.png'; Entries = @(
    @{ Id = 'rata-gigante'; Quadrant = 'tl' }, @{ Id = 'arana-gigante'; Quadrant = 'tr' },
    @{ Id = 'enjambre-ratas'; Quadrant = 'bl' }, @{ Id = 'caballo-guerra'; Quadrant = 'br' }
  ) }
)

function New-CircularToken {
  param(
    [string]$SourcePath,
    [string]$Quadrant,
    [string]$OutputPath,
    [string]$GridOutputPath,
    [int[]]$Crop
  )

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $halfWidth = [int]($source.Width / 2)
    $halfHeight = [int]($source.Height / 2)
    if ($Crop) {
      $sourceRect = [System.Drawing.Rectangle]::new($Crop[0], $Crop[1], $Crop[2], $Crop[3])
    } else {
      $sourceRect = switch ($Quadrant) {
        'tl' { [System.Drawing.Rectangle]::new(0, 0, $halfWidth, $halfHeight) }
        'tr' { [System.Drawing.Rectangle]::new($halfWidth, 0, $source.Width - $halfWidth, $halfHeight) }
        'bl' { [System.Drawing.Rectangle]::new(0, $halfHeight, $halfWidth, $source.Height - $halfHeight) }
        'br' { [System.Drawing.Rectangle]::new($halfWidth, $halfHeight, $source.Width - $halfWidth, $source.Height - $halfHeight) }
        default { [System.Drawing.Rectangle]::new(0, 0, $source.Width, $source.Height) }
      }
    }

    $token = [System.Drawing.Bitmap]::new(
      256,
      256,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $token.SetResolution(256, 256)

    try {
      $graphics = [System.Drawing.Graphics]::FromImage($token)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $clipPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
        try {
          $clipPath.AddEllipse(8, 8, 240, 240)
          $graphics.SetClip($clipPath)
          $graphics.DrawImage(
            $source,
            [System.Drawing.Rectangle]::new(8, 8, 240, 240),
            $sourceRect,
            [System.Drawing.GraphicsUnit]::Pixel
          )
          $graphics.ResetClip()
        } finally {
          $clipPath.Dispose()
        }

        $outerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 18, 22, 28), 8)
        $innerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 214, 178, 96), 3)
        try {
          $graphics.DrawEllipse($outerPen, 6, 6, 244, 244)
          $graphics.DrawEllipse($innerPen, 10, 10, 236, 236)
        } finally {
          $outerPen.Dispose()
          $innerPen.Dispose()
        }
      } finally {
        $graphics.Dispose()
      }

      $token.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

      $gridToken = [System.Drawing.Bitmap]::new(
        48,
        48,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
      )
      try {
        $gridGraphics = [System.Drawing.Graphics]::FromImage($gridToken)
        try {
          $gridGraphics.Clear([System.Drawing.Color]::Transparent)
          $gridGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $gridGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $gridGraphics.DrawImage($token, 0, 0, 48, 48)
        } finally {
          $gridGraphics.Dispose()
        }
        $gridToken.Save($GridOutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $gridToken.Dispose()
      }
    } finally {
      $token.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Export-TokenSet {
  param(
    [array]$Sources,
    [string]$SourceDirectory,
    [string]$OutputDirectory,
    [string]$GridOutputDirectory
  )

  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  New-Item -ItemType Directory -Force -Path $GridOutputDirectory | Out-Null

  foreach ($sourceDefinition in $Sources) {
    $sourcePath = Join-Path $SourceDirectory $sourceDefinition.File
    foreach ($entry in $sourceDefinition.Entries) {
      $outputPath = Join-Path $OutputDirectory ($entry.Id + '.png')
      $gridOutputPath = Join-Path $GridOutputDirectory ($entry.Id + '.png')
      New-CircularToken `
        -SourcePath $sourcePath `
        -Quadrant $entry.Quadrant `
        -OutputPath $outputPath `
        -GridOutputPath $gridOutputPath
    }
  }
}

if (-not $NerezzaOnly) {
  Export-TokenSet `
    -Sources $npcSources `
    -SourceDirectory (Join-Path $ProjectRoot 'public/assets/npcs') `
    -OutputDirectory (Join-Path $ProjectRoot 'public/assets/tokens/npcs') `
    -GridOutputDirectory (Join-Path $ProjectRoot 'public/assets/tokens-grid/npcs')

  Export-TokenSet `
    -Sources $playerSources `
    -SourceDirectory (Join-Path $ProjectRoot 'public/assets/players') `
    -OutputDirectory (Join-Path $ProjectRoot 'public/assets/tokens/players') `
    -GridOutputDirectory (Join-Path $ProjectRoot 'public/assets/tokens-grid/players')

  Export-TokenSet `
    -Sources $genericSources `
    -SourceDirectory (Join-Path $ProjectRoot 'public/assets/generic-npcs') `
    -OutputDirectory (Join-Path $ProjectRoot 'public/assets/tokens/generic') `
    -GridOutputDirectory (Join-Path $ProjectRoot 'public/assets/tokens-grid/generic')
}

$namedPlayerSource = Join-Path $ProjectRoot 'public/assets/players/named-player-sheet.png'
$namedPlayerOutput = Join-Path $ProjectRoot 'public/assets/tokens/players'
$namedPlayerGridOutput = Join-Path $ProjectRoot 'public/assets/tokens-grid/players'
$namedPlayers = @(
  @{ Id = 'valian-foregon'; Crop = @(286, 84, 231, 231) },
  @{ Id = 'erwan-valae'; Crop = @(286, 575, 230, 230) },
  @{ Id = 'megara-bell'; Crop = @(792, 575, 235, 235) },
  @{ Id = 'durgan-piedrafirme'; Crop = @(670, 1075, 300, 300) }
)

if (-not $NerezzaOnly) {
  foreach ($player in $namedPlayers) {
    New-CircularToken `
      -SourcePath $namedPlayerSource `
      -Quadrant 'full' `
      -OutputPath (Join-Path $namedPlayerOutput ($player.Id + '.png')) `
      -GridOutputPath (Join-Path $namedPlayerGridOutput ($player.Id + '.png')) `
      -Crop $player.Crop
  }
}

New-CircularToken `
  -SourcePath (Join-Path $ProjectRoot 'public/assets/players/nerezza-vhal-sheet.png') `
  -Quadrant 'full' `
  -OutputPath (Join-Path $namedPlayerOutput 'picaro-embaucador.png') `
  -GridOutputPath (Join-Path $namedPlayerGridOutput 'picaro-embaucador.png') `
  -Crop @(763, 145, 239, 239)

if ($NerezzaOnly) {
  Write-Output "Updated only the Nerezza Vhal token at 256 px and 48 px."
} else {
  Write-Output "Generated 121 circular tokens at 256 px and 121 map-ready tokens at 48 px."
}
