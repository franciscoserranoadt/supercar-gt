import glob
out=open('three.bundle.js').read()+'\n'
out+='(function () {\n'+'\n'.join(open(f).read() for f in sorted(glob.glob('0*.js')))+'\n})();\n'
open('../app/src/main/assets/game.js','w').write(out); print(len(out))
