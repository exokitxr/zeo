﻿using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Zeo_VR_Server_Reset
{
    class Program
    {
        static void Main(string[] args)
        {
            Process cmd = new Process();

            cmd.StartInfo.FileName = "node\\node.exe";
            cmd.StartInfo.Arguments = "index.js connect";
            cmd.StartInfo.RedirectStandardInput = true;
            cmd.StartInfo.RedirectStandardOutput = true;
            cmd.StartInfo.RedirectStandardError = true;
            cmd.StartInfo.CreateNoWindow = false;
            cmd.StartInfo.UseShellExecute = false;
            cmd.OutputDataReceived += (sender, args2) => Console.WriteLine(args2.Data);
            cmd.ErrorDataReceived += (sender, args2) => Console.WriteLine(args2.Data);

            cmd.Start();
            cmd.BeginOutputReadLine();
            cmd.BeginErrorReadLine();
            cmd.WaitForExit();
        }
    }
}