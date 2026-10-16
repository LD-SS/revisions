@echo off
rem ==================================================================
rem  REVISIONS - lance l'appli sur ton PC (serveur local + navigateur)
rem  Double-clique sur ce fichier. Pour arreter : ferme la fenetre noire.
rem ==================================================================
title Revisions - serveur local
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serveur-local.ps1"
if errorlevel 1 pause
