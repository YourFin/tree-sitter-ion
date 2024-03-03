{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    utils.url = "github:numtide/flake-utils";
    ion-tests = {
      url = "github:amazon-ion/ion-tests";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, utils, ion-tests }:
    let
      out = system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [ self.overlay ];
          };
          grammar = pkgs.tree-sitter-grammars.tree-sitter-ion;
        in {
          devShell = pkgs.mkShell {
            packages = with pkgs;
              [
                # extra dev tools
              ];
            inputsFrom = with pkgs; [ grammar ];
            shellHook = ''
              export ION_TESTS_DIR=${ion-tests}
              export TREE_SITTER_DIN=${pkgs.tree-sitter}
            '';
          };

          packages = { tree-sitter-grammars.tree-sitter-ion = grammar; };
          defaultPackage = grammar;
        };
    in with utils.lib;
    {
      overlay = final: prev: {
        tree-sitter-grammars = prev.tree-sitter-grammars // {
          tree-sitter-ion = final.callPackage ./ion-grammar.nix { };
        };
        vimPlugins = prev.vimPlugins // {
          nvim-treesitter-ion = final.callPackage ./nvim-plugin.nix { };
        };
      };
    } // eachSystem defaultSystems out;

}
