#define MyAppId "{{5C6A6A5A-6D4A-4E80-99A6-6BB682F6BE4C}}"
#define MyAppName "工资薪金个税计算器"
#define MyAppPublisher "Reirei-syu"
#define MyAppURL "https://github.com/Reirei-syu/dude-tax"
#define MyAppExeName "dude-tax.exe"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion=__APP_VERSION__
AppVerName={#MyAppName} __APP_VERSION__
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\DudeTax
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=__OUTPUT_DIR__
OutputBaseFilename=__OUTPUT_BASE_FILENAME__
SetupIconFile=__SETUP_ICON_FILE__
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
VersionInfoVersion=__VERSION_INFO__

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: unchecked

[Files]
Source: "__SOURCE_DIR__\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动{#MyAppName}"; Flags: nowait postinstall skipifsilent
