import requests
from Crypto.Util.number import long_to_bytes

apipath = "http://localhost:3000/api/"

i1 = requests.get(apipath+"newidentity").json()
i1c = requests.post(apipath+"recoveridentity", json={"privateKey":i1['privateKey']}).json() 
i2 = requests.get(apipath+"newidentity").json()
i3 = requests.get(apipath+"newidentity").json()

gid1 = requests.get(apipath+"newgroup").json()['groupId']
gid2 = requests.get(apipath+"newgroup").json()['groupId']
gid3 = requests.get(apipath+"newgroup").json()['groupId']

# add i1 and i3 to gid1 
print("0:", requests.get(apipath+"grouproot?groupId="+str(gid1)).json())
requests.post(apipath+"addtogroup", json={"groupId": gid1, "commitment": i1['commitment']})
requests.post(apipath+"addtogroup", json={"groupId": gid1, "commitment": i1['commitment']})
requests.post(apipath+"addtogroup", json={"groupId": gid1, "commitment": i1['commitment']})
print("SOMEROOT:", requests.get(apipath+"grouproot?groupId="+str(gid1)).json())
requests.post(apipath+"addtogroup", json={"groupId": gid1, "commitment": i3['commitment']})
print("SAMEROOT:", requests.get(apipath+"grouproot?groupId="+str(gid1)).json())
# TODO what abt adding same member multiple times uhh 

idx1 = requests.get(apipath+"getgroupidx?groupId={}&commitment={}".format(gid1, i1c['commitment'])).json()['idx'] # hehe i1 copy 
print("NOT IN GROUP:", requests.get(apipath+"getgroupidx?groupId={}&commitment={}".format(gid1, i2['commitment'])).json()) 
idx3 = requests.get(apipath+"getgroupidx?groupId={}&commitment={}".format(gid1, i3['commitment'])).json()['idx'] 

# get merkle proof for idx3
mp1 = requests.get(apipath+"getmerkleproof?groupId={}&commitment={}".format(gid1, i1['commitment'])).json() 
mp3 = requests.get(apipath+"getmerkleproof?groupId={}&commitment={}".format(gid1, i3['commitment'])).json() 
print("THESE SHOULD SHARE", i1['commitment']) 
print(mp1['siblings'])
print(mp3['siblings'])

# indeed, we see that both have a shared sibling that is i1['commitment'] so it's correct structure 
pr1 = {"merkleProof": mp1, "privateKey":i1['privateKey'],
       "message": "hello world", "scope": 103897}
proof1 = requests.post(apipath+"generateproof", json=pr1).json() 
print("HELLO WORLD MESSAGE:", repr(long_to_bytes(int(proof1['message']))))

ver = requests.post(apipath+"verifyproof", json=proof1).json()
print("VERIFIED:", ver) 
